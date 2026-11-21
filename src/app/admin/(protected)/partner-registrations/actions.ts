"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin-access";
import { appendAdminReviewQueueQuery } from "@/lib/admin-review-queue";
import { assertAdminCanAccessManagedCampuses } from "@/lib/admin-scope";
import {
  sendAndRecordCampusScopedNewPartnerNotification,
} from "@/lib/new-partner-notifications";
import {
  canTransitionPartnerRegistrationStatus,
  isPartnerRegistrationRequestStatus,
  type PartnerRegistrationRequestStatus,
} from "@/lib/partner-registration";
import {
  hasPartnerRegistrationFieldErrors,
  validatePartnerRegistrationInput,
} from "@/lib/partner-registration";
import {
  createPartnerFromPortalRegistrationRequest,
  PartnerRegistrationConversionCleanupError,
  resolveRegistrationManagedCampusSlugs,
  rollbackPartnerRegistrationRequestStatus,
  type ConvertedPartnerRow,
  type PartnerRegistrationRequestRow,
  type RegistrationCompanyProvisioner,
} from "@/lib/partner-registration-conversion.server";
import { loadPartnerRegistrationCategories } from "@/lib/partner-registration-submit.server";
import { resolvePartnerRegistrationCategory } from "@/lib/partner-registration";
import { normalizePartnerBenefitItems } from "@/lib/partner-benefit-items";
import { hashCouponVerificationPassword } from "@/lib/coupon-verification-password";
import {
  cleanupPartnerCompanyProvision,
  ensurePartnerCompanyRow,
} from "@/app/admin/(protected)/_actions/partner-support/company-provision";
import type { PartnerCompanyProvision } from "@/app/admin/(protected)/_actions/shared-types";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getPartnerVisibilityState,
  isPartnerVisibility,
} from "@/lib/partner-visibility";
import {
  logAdminAction,
  redirectAdminActionError,
  revalidateAdminAndPublicPaths,
} from "@/app/admin/(protected)/_actions/shared-helpers";
import { sanitizeReturnTo } from "@/lib/return-to";
import type { PartnerVisibility } from "@/lib/types";
import { isFourDigitPin } from "@/lib/validation";
import { PartnerMutationOutcomeUnknownError } from "@/lib/partner-admin/mutation-outcome";

const registrationCompanyProvisioner = {
  ensure: (supabase, input, options) =>
    ensurePartnerCompanyRow(supabase, input, true, options),
  cleanup: cleanupPartnerCompanyProvision,
} satisfies RegistrationCompanyProvisioner<PartnerCompanyProvision>;
import { logServerError } from "@/lib/server-log";

export async function updatePartnerRegistrationRequestStatus(formData: FormData) {
  const returnTo = sanitizeReturnTo(
    String(formData.get("returnTo") ?? ""),
    "/admin/partner-registrations",
  );
  const adminSession = await requireAdminPermission("brands", "update", {
    path: returnTo,
  });

  const id = String(formData.get("id") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const visibility = String(formData.get("visibility") || "public").trim();
  const adminNote = String(formData.get("adminNote") || "").trim();

  if (
    !id ||
    !isPartnerRegistrationRequestStatus(status) ||
    !isPartnerVisibility(visibility)
  ) {
    redirectAdminActionError(returnTo, "partner_form_invalid_request");
  }

  const supabase = getSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("partner_registration_requests")
    .select(
      "id,status,visibility,admin_note,reviewed_by_admin_id,reviewed_at,source,company_id,registration_mode,service_mode,benefit_action_type,benefit_items,benefit_verification_pin_hash,benefit_verification_pin_salt,branch_scope_type,branch_scope_note,brand_name,category_id,category_label,period_start,period_end,inquiry_link,brand_phone,detail_description,company_name,contact_name,contact_email,contact_phone,company_description,benefits,conditions,tags,location,map_url,site_link,benefit_action_link,thumbnail_url,image_urls,company:partner_companies(managed_campus_slugs)",
    )
    .eq("id", id)
    .maybeSingle();

  if (requestError || !request) {
    redirectAdminActionError(returnTo, "partner_form_not_found");
  }

  const registrationRequest = request as PartnerRegistrationRequestRow;
  const previousStatus = isPartnerRegistrationRequestStatus(registrationRequest.status)
    ? registrationRequest.status
    : "pending";
  const managedCampusSlugs = resolveRegistrationManagedCampusSlugs(registrationRequest);
  try {
    assertAdminCanAccessManagedCampuses(adminSession.account, managedCampusSlugs);
  } catch {
    redirectAdminActionError(returnTo, "regional_admin_scope_denied");
  }

  if (!canTransitionPartnerRegistrationStatus(previousStatus, status)) {
    redirectAdminActionError(returnTo, "partner_form_status_locked", {
      action: "partner_update",
      targetType: "partner_registration_request",
      targetId: registrationRequest.id,
      properties: {
        previousStatus,
        requestedStatus: status,
        stage: "status_transition",
      },
    });
  }

  const payload: {
    status: PartnerRegistrationRequestStatus;
    visibility: PartnerVisibility;
    admin_note: string | null;
    reviewed_by_admin_id?: string | null;
    reviewed_at?: string | null;
  } = {
    status,
    visibility,
    admin_note: adminNote || null,
  };

  if (status !== "pending") {
    payload.reviewed_by_admin_id = adminSession.adminId;
    payload.reviewed_at = new Date().toISOString();
  }

  const { data: updatedRequest, error: updateError } = await supabase
    .from("partner_registration_requests")
    .update(payload)
    .eq("id", id)
    .eq("status", previousStatus)
    .select("id")
    .maybeSingle();
  if (updateError) {
    logServerError("[partner-registration] status update failed", updateError);
    redirectAdminActionError(returnTo, "partner_form_invalid_request");
  }

  if (!updatedRequest || typeof updatedRequest !== "object" || Array.isArray(updatedRequest) || updatedRequest.id !== id) {
    redirect(appendAdminReviewQueueQuery(returnTo, { success: "already-updated" }));
  }

  let convertedPartnerId: string | null = null;
  let convertedPartnerIds: string[] = [];
  const notificationFailedPartnerIds: string[] = [];
  if (status === "converted" && previousStatus !== "converted") {
    let convertedPartners: ConvertedPartnerRow[];
    try {
      const conversion = await createPartnerFromPortalRegistrationRequest({
        supabase,
        request: { ...registrationRequest, visibility },
        campusSlugs: managedCampusSlugs,
        companyProvisioner: registrationCompanyProvisioner,
      });
      if (conversion.partners.length === 0) {
        throw new Error("등록 가능한 제휴처가 생성되지 않았습니다.");
      }
      convertedPartners = conversion.partners;
    } catch (error) {
      const mutationOutcomeUnknown = error instanceof PartnerMutationOutcomeUnknownError;
      const cleanupCompleted = !mutationOutcomeUnknown && !(error instanceof PartnerRegistrationConversionCleanupError);
      // Incomplete compensation may leave partner rows behind. Keep this
      // request terminal until an operator reconciles those resources.
      const rollbackSucceeded = cleanupCompleted && await rollbackPartnerRegistrationRequestStatus({
        supabase,
        request: registrationRequest,
        requestedStatus: status,
      });
      const message =
        error instanceof Error
          ? error.message
          : "제휴처 등록 신청 승인 후처리에 실패했습니다.";
      logServerError("[partner-registration] conversion failed", message);
      if (cleanupCompleted && !rollbackSucceeded) {
        logServerError(
          "[partner-registration] converted status rollback failed",
        );
      }
      revalidatePath("/admin/partner-registrations");
      // `converted` is terminal, so a request left in it by a failed restore
      // cannot be reverted from the queue. Say so instead of claiming the
      // restore succeeded, and keep the outcome in the audit record.
      const conversionFailureCode = rollbackSucceeded
        ? "partner_form_conversion_failed"
        : "partner_form_conversion_status_unrestored";
      redirectAdminActionError(returnTo, conversionFailureCode, {
        action: "partner_create",
        targetType: "partner_registration_request",
        targetId: registrationRequest.id,
        properties: {
          previousStatus,
          requestedStatus: status,
          stage: "conversion",
          cleanupCompleted,
          statusRestored: rollbackSucceeded,
          mutationOutcomeUnknown,
          mutationStage: mutationOutcomeUnknown ? error.stage : null,
          statusRollbackSkippedReason: mutationOutcomeUnknown
            ? "mutation_outcome_unknown"
            : cleanupCompleted ? null : "conversion_cleanup_incomplete",
        },
      });
    }

    // Creation has committed. Follow-up failures must never reopen this request.
    convertedPartnerIds = convertedPartners.map((partner) => partner.id);
    convertedPartnerId =
      convertedPartners.length === 1
        ? convertedPartners[0]?.id ?? null
        : null;

    for (const partner of convertedPartners) {
      await logAdminAction("partner_create", {
        targetType: "partner",
        targetId: partner.id,
        properties: {
          source: "partner_registration_request",
          requestId: registrationRequest.id,
          requestSource: registrationRequest.source ?? null,
          name: partner.name,
          categoryId: registrationRequest.category_id ?? null,
          categoryLabel: registrationRequest.category_label,
          location: partner.location,
          campusSlugs: partner.campus_slugs ?? managedCampusSlugs,
          companyId: registrationRequest.company_id ?? null,
        },
      });

      if (
        getPartnerVisibilityState(
          partner.visibility === "public" ? "public" : "private",
          partner.period_start,
          partner.period_end,
        ) === "public"
      ) {
        try {
          await sendAndRecordCampusScopedNewPartnerNotification({
            partnerId: partner.id,
            name: partner.name,
            location: partner.location,
            categoryLabel: registrationRequest.category_label,
            campusSlugs: partner.campus_slugs ?? managedCampusSlugs,
            benefitSummary: (partner.benefits ?? []).join("\n"),
            conditions: (partner.conditions ?? []).join("\n"),
            periodStart: partner.period_start,
            periodEnd: partner.period_end,
            mapUrl: partner.map_url,
          });
        } catch (error) {
          notificationFailedPartnerIds.push(partner.id);
          logServerError("[partner-registration] converted notification failed", error, {
            requestId: registrationRequest.id,
            partnerId: partner.id,
          });
        }
      }

      revalidateAdminAndPublicPaths(partner.id);
    }
  }

  await logAdminAction("partner_update", {
    targetType: "partner_registration_request",
    targetId: registrationRequest.id,
    properties: {
      source: "admin_partner_registration_queue",
      changeType: "status",
      previousStatus,
      status,
      previousVisibility: registrationRequest.visibility ?? null,
      visibility,
      adminNoteChanged: (registrationRequest.admin_note ?? "") !== adminNote,
      convertedPartnerIds,
      notificationFailedPartnerIds,
    },
  });

  revalidatePath("/admin/partner-registrations");
  if (convertedPartnerId) {
    redirect(`/admin/partners/${convertedPartnerId}`);
  }
  redirect(appendAdminReviewQueueQuery(returnTo, { success: "updated" }));
}

function areStringArraysEqual(left?: string[] | null, right?: string[] | null) {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}

function preservePartnerBenefitLimits(
  existingItems: unknown,
  benefitTitles: readonly string[],
) {
  let existingBenefits: ReturnType<typeof normalizePartnerBenefitItems> = [];
  try {
    existingBenefits = normalizePartnerBenefitItems(existingItems ?? []);
  } catch {
    existingBenefits = [];
  }

  if (existingBenefits.length === 0) {
    return normalizePartnerBenefitItems(
      benefitTitles.map((title, index) => ({
        id: `registration-benefit-${index + 1}`,
        title,
      })),
    );
  }

  return normalizePartnerBenefitItems(
    benefitTitles.map((title, index) => ({
      id: existingBenefits[index]?.id,
      title,
      maxApplyCount: existingBenefits[index]?.maxApplyCount,
    })),
  );
}

export async function updatePartnerRegistrationRequestDetails(formData: FormData) {
  const returnTo = sanitizeReturnTo(
    String(formData.get("returnTo") ?? ""),
    "/admin/partner-registrations",
  );
  const adminSession = await requireAdminPermission("brands", "update", {
    path: returnTo,
  });
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    redirectAdminActionError(returnTo, "partner_form_details_invalid");
  }

  const supabase = getSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("partner_registration_requests")
    .select(
      "id,status,source,company_id,registration_mode,service_mode,benefit_action_type,benefit_items,benefit_verification_pin_hash,benefit_verification_pin_salt,branch_scope_type,branch_scope_note,brand_name,category_id,category_label,period_start,period_end,inquiry_link,brand_phone,detail_description,company_name,contact_name,contact_email,contact_phone,company_description,benefits,conditions,tags,location,map_url,site_link,benefit_action_link,thumbnail_url,image_urls,company:partner_companies(managed_campus_slugs)",
    )
    .eq("id", id)
    .maybeSingle();

  if (requestError || !request) {
    redirectAdminActionError(returnTo, "partner_form_not_found");
  }

  const registrationRequest = request as PartnerRegistrationRequestRow;
  if (registrationRequest.status === "converted") {
    redirectAdminActionError(returnTo, "partner_form_details_locked");
  }

  try {
    assertAdminCanAccessManagedCampuses(
      adminSession.account,
      resolveRegistrationManagedCampusSlugs(registrationRequest),
    );
  } catch {
    redirectAdminActionError(returnTo, "regional_admin_scope_denied");
  }

  let categories;
  try {
    categories = await loadPartnerRegistrationCategories();
  } catch {
    redirectAdminActionError(returnTo, "partner_form_details_invalid");
  }

  const validation = validatePartnerRegistrationInput({
    registrationMode: registrationRequest.registration_mode ?? "full_new",
    serviceMode: registrationRequest.service_mode,
    benefitActionType: String(
      formData.get("benefitActionType") ?? registrationRequest.benefit_action_type,
    ),
    // Branch membership is not edited in this form. Preserve the existing scope
    // while validating the editable request fields.
    branchScopeType: "single_location",
    branchScopeNote: String(
      formData.get("branchScopeNote") ?? registrationRequest.branch_scope_note ?? "",
    ),
    brandName: String(formData.get("brandName") ?? ""),
    categoryLabel: String(formData.get("categoryLabel") ?? ""),
    periodStart: String(formData.get("periodStart") ?? ""),
    periodEnd: String(formData.get("periodEnd") ?? ""),
    inquiryLink: String(formData.get("inquiryLink") ?? ""),
    brandPhone: String(formData.get("brandPhone") ?? ""),
    detailDescription: String(formData.get("detailDescription") ?? ""),
    companyName: registrationRequest.company_name,
    contactName: String(formData.get("contactName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    companyDescription: String(formData.get("companyDescription") ?? ""),
    benefits: String(formData.get("benefits") ?? ""),
    conditions: String(formData.get("conditions") ?? ""),
    tags: String(formData.get("tags") ?? ""),
    location: String(formData.get("location") ?? ""),
    mapUrl: String(formData.get("mapUrl") ?? ""),
    siteLink: String(formData.get("siteLink") ?? ""),
    benefitActionLink: String(formData.get("benefitActionLink") ?? ""),
    branchListText: "",
    memo: String(formData.get("memo") ?? ""),
    benefitItems: String(formData.get("benefitItems") ?? ""),
  });
  if (hasPartnerRegistrationFieldErrors(validation.fieldErrors)) {
    redirectAdminActionError(returnTo, "partner_form_details_invalid");
  }

  const values = validation.values;
  const matchedCategory = resolvePartnerRegistrationCategory(
    values.categoryLabel,
    categories,
  );
  const { data: benefitGroups, error: benefitGroupsError } = await supabase
    .from("partner_registration_benefit_groups")
    .select("id,group_key")
    .eq("registration_request_id", id)
    .order("created_at", { ascending: true });
  if (benefitGroupsError) {
    redirectAdminActionError(returnTo, "partner_form_details_invalid");
  }

  const multipleBenefitGroups = (benefitGroups ?? []).length > 1;
  const benefitsChanged = !areStringArraysEqual(
    values.parsedBenefits,
    registrationRequest.benefits,
  );
  const conditionsChanged = !areStringArraysEqual(
    values.parsedConditions,
    registrationRequest.conditions,
  );
  const tagsChanged = !areStringArraysEqual(values.parsedTags, registrationRequest.tags);
  if (multipleBenefitGroups && (benefitsChanged || conditionsChanged || tagsChanged)) {
    redirectAdminActionError(returnTo, "partner_form_multiple_groups");
  }

  const structuredBenefitItems = String(formData.get("benefitItems") ?? "").trim();
  let benefitItems;
  try {
    benefitItems = structuredBenefitItems
      ? values.parsedBenefitItems
      : preservePartnerBenefitLimits(
          registrationRequest.benefit_items,
          values.parsedBenefits,
        );
  } catch {
    redirectAdminActionError(returnTo, "partner_form_details_invalid");
  }

  const rawBenefitVerificationPin = String(
    formData.get("benefitVerificationPin") ?? "",
  ).trim();
  if (rawBenefitVerificationPin && !isFourDigitPin(rawBenefitVerificationPin)) {
    redirectAdminActionError(returnTo, "partner_form_details_invalid");
  }
  let benefitVerificationPinUpdate: {
    benefit_verification_pin_hash?: string | null;
    benefit_verification_pin_salt?: string | null;
  } = {};
  if (rawBenefitVerificationPin) {
    try {
      const hashedPin = await hashCouponVerificationPassword(
        rawBenefitVerificationPin,
      );
      benefitVerificationPinUpdate = {
        benefit_verification_pin_hash: hashedPin.hash,
        benefit_verification_pin_salt: hashedPin.salt,
      };
    } catch {
      redirectAdminActionError(returnTo, "partner_form_details_invalid");
    }
  }

  const group = (benefitGroups ?? [])[0] as
    | { id?: string | null; group_key?: string | null }
    | undefined;
  if (group?.id) {
    const { error } = await supabase
      .from("partner_registration_benefit_groups")
      .update({
        benefit_action_type: values.benefitActionType,
        benefit_action_link: values.safeBenefitActionLink,
        benefits: values.parsedBenefits,
        conditions: values.parsedConditions,
        period_start: values.periodStart || null,
        period_end: values.periodEnd || null,
        tags: values.parsedTags,
      })
      .eq("id", group.id);
    if (error) {
      logServerError("[partner-registration] details group update failed", error);
      redirectAdminActionError(returnTo, "partner_form_details_invalid");
    }
  }

  const { error: updateError } = await supabase
      .from("partner_registration_requests")
    .update({
      ...benefitVerificationPinUpdate,
      benefit_items: benefitItems.map((benefit, displayOrder) => ({
        id: benefit.id,
        title: benefit.title,
        maxApplyCount: benefit.maxApplyCount,
        displayOrder,
      })),
      branch_scope_note: values.branchScopeNote || null,
      brand_name: values.brandName,
      category_id: matchedCategory?.id ?? null,
      category_label: matchedCategory?.label ?? values.categoryLabel,
      period_start: values.periodStart || null,
      period_end: values.periodEnd || null,
      inquiry_link: values.safeInquiryLink,
      brand_phone: values.safeBrandPhone,
      detail_description: values.detailDescription || null,
      contact_name: values.contactName,
      contact_email: values.contactEmail,
      contact_phone: values.contactPhone || null,
      company_description: values.companyDescription || null,
      benefits: values.parsedBenefits,
      conditions: values.parsedConditions,
      tags: values.parsedTags,
      location: values.location,
      map_url: values.safeMapUrl,
      site_link: values.safeSiteLink,
      benefit_action_link: values.safeBenefitActionLink,
      memo: values.memo || null,
    })
    .eq("id", id);
  if (updateError) {
    logServerError("[partner-registration] details update failed", updateError);
    redirectAdminActionError(returnTo, "partner_form_details_invalid");
  }

  await logAdminAction("partner_update", {
    targetType: "partner_registration_request",
    targetId: id,
    properties: {
      source: "admin_partner_registration_queue",
      changedFields: [
        "brand_name",
        "category",
        "location",
        "period",
        "contact",
        "description",
        "benefits",
        "conditions",
        "tags",
      ],
    },
  });
  revalidatePath("/admin/partner-registrations");
  redirect(appendAdminReviewQueueQuery(returnTo, { success: "details-updated" }));
}
