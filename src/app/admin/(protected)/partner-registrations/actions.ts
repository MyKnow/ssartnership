"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin-access";
import { appendAdminReviewQueueQuery } from "@/lib/admin-review-queue";
import { assertAdminCanAccessManagedCampuses } from "@/lib/admin-scope";
import { inferCampusSlugsFromLocation, normalizeCampusSlugs } from "@/lib/campuses";
import {
  sendAndRecordCampusScopedNewPartnerNotification,
} from "@/lib/new-partner-notifications";
import {
  isPartnerRegistrationRequestStatus,
  type PartnerRegistrationRequestStatus,
} from "@/lib/partner-registration";
import {
  hasPartnerRegistrationFieldErrors,
  validatePartnerRegistrationInput,
} from "@/lib/partner-registration";
import { loadPartnerRegistrationCategories } from "@/lib/partner-registration-submit.server";
import {
  DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
  normalizeBenefitGroupKey,
} from "@/lib/partner-branch-registration";
import { persistPartnerBranchLinks } from "@/lib/partner-branch-links.server";
import { resolvePartnerRegistrationCategory } from "@/lib/partner-registration";
import { normalizePartnerBenefitItems } from "@/lib/partner-benefit-items";
import { hashCouponVerificationPassword } from "@/lib/coupon-verification-password";
import {
  cleanupPartnerCompanyProvision,
  ensurePartnerCompanyRow,
} from "@/app/admin/(protected)/_actions/partner-support/company-provision";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getPartnerVisibilityState,
  isPartnerVisibility,
} from "@/lib/partner-visibility";
import {
  logAdminAction,
  redirectAdminActionError,
  revalidateAdminAndPublicPaths,
  revalidatePartnerData,
} from "@/app/admin/(protected)/_actions/shared-helpers";
import { sanitizeReturnTo } from "@/lib/return-to";

type RegistrationCompanyRelation =
  | { managed_campus_slugs?: string[] | null }
  | Array<{ managed_campus_slugs?: string[] | null }>
  | null
  | undefined;

type PartnerRegistrationRequestRow = {
  id: string;
  status: string;
  visibility?: string | null;
  admin_note?: string | null;
  reviewed_by_admin_id?: string | null;
  reviewed_at?: string | null;
  source?: string | null;
  company_id?: string | null;
  registration_mode?: string | null;
  service_mode: string;
  benefit_action_type: string;
  benefit_items?: unknown;
  benefit_verification_pin_hash?: string | null;
  benefit_verification_pin_salt?: string | null;
  branch_scope_type?: string | null;
  branch_scope_note?: string | null;
  brand_name: string;
  category_id?: string | null;
  category_label: string;
  period_start?: string | null;
  period_end?: string | null;
  inquiry_link?: string | null;
  detail_description?: string | null;
  brand_phone?: string | null;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string | null;
  company_description?: string | null;
  benefits?: string[] | null;
  conditions?: string[] | null;
  tags?: string[] | null;
  location: string;
  map_url?: string | null;
  site_link?: string | null;
  benefit_action_link?: string | null;
  thumbnail_url?: string | null;
  image_urls?: string[] | null;
  company?: RegistrationCompanyRelation;
};

type ConvertedPartnerRow = {
  id: string;
  name: string;
  location: string;
  campus_slugs?: string[] | null;
  visibility?: string | null;
  benefits?: string[] | null;
  conditions?: string[] | null;
  period_start?: string | null;
  period_end?: string | null;
  map_url?: string | null;
};

type RegistrationBenefitGroupRow = {
  group_key: string;
  label: string;
  benefit_action_type?: string | null;
  benefit_action_link?: string | null;
  benefits?: string[] | null;
  conditions?: string[] | null;
  period_start?: string | null;
  period_end?: string | null;
  tags?: string[] | null;
};

type RegistrationBranchRow = {
  benefit_group_key?: string | null;
  branch_key: string;
  branch_code?: string | null;
  name: string;
  address: string;
  branch_type?: string | null;
  campus_slugs?: string[] | null;
  map_url?: string | null;
  phone?: string | null;
  memo?: string | null;
};

type RegistrationConversionResources = {
  companyProvision: Awaited<ReturnType<typeof ensurePartnerCompanyRow>> | null;
  createdBrandProfileId: string | null;
  createdPartnerIds: string[];
};

function getRegistrationCompany(company: RegistrationCompanyRelation) {
  return Array.isArray(company) ? (company[0] ?? null) : (company ?? null);
}

function resolveRegistrationManagedCampusSlugs(
  request: PartnerRegistrationRequestRow,
) {
  const company = getRegistrationCompany(request.company);
  return normalizeCampusSlugs(
    company?.managed_campus_slugs ??
      inferCampusSlugsFromLocation(request.location),
  );
}

function normalizeRegistrationBenefitGroupKey(value?: string | null) {
  return normalizeBenefitGroupKey(value, DEFAULT_PARTNER_BENEFIT_GROUP_KEY);
}

async function rollbackRegistrationConversionResources(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  resources: RegistrationConversionResources,
) {
  const cleanupFailures: Array<{
    stage: string;
    code?: string;
    message: string;
  }> = [];

  if (resources.createdPartnerIds.length > 0) {
    const { error } = await supabase
      .from("partners")
      .delete()
      .in("id", resources.createdPartnerIds);
    if (error) {
      cleanupFailures.push({
        stage: "partners",
        code: error.code,
        message: error.message,
      });
    }
  }

  if (resources.createdBrandProfileId) {
    const { error } = await supabase
      .from("partner_brand_profiles")
      .delete()
      .eq("id", resources.createdBrandProfileId);
    if (error) {
      cleanupFailures.push({
        stage: "partner_brand_profile",
        code: error.code,
        message: error.message,
      });
    }
  }

  await cleanupPartnerCompanyProvision(supabase, resources.companyProvision).catch(
    (error: unknown) => {
      cleanupFailures.push({
        stage: "partner_company_provision",
        message:
          error instanceof Error ? error.message : "unknown cleanup error",
      });
    },
  );

  if (cleanupFailures.length > 0) {
    console.error(
      "[partner-registration] conversion rollback failed",
      cleanupFailures,
    );
    throw new Error("partner_registration_conversion_cleanup_failed");
  }
}

async function findExistingConvertedPartner(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  request: PartnerRegistrationRequestRow,
) {
  let query = supabase
    .from("partners")
    .select("id,name,location,campus_slugs,visibility")
    .eq("name", request.brand_name)
    .eq("location", request.location)
    .limit(1);

  if (request.company_id) {
    query = query.eq("company_id", request.company_id);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? null) as ConvertedPartnerRow | null;
}

async function createPartnerFromPortalRegistrationRequest({
  supabase,
  request,
  campusSlugs,
}: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  request: PartnerRegistrationRequestRow;
  campusSlugs: string[];
}) {
  if (!request.category_id) {
    return { partners: [], created: false };
  }

  const normalizedCampusSlugs = normalizeCampusSlugs(campusSlugs);
  if (normalizedCampusSlugs.length === 0) {
    return { partners: [], created: false };
  }

  const resources: RegistrationConversionResources = {
    companyProvision: null,
    createdBrandProfileId: null,
    createdPartnerIds: [],
  };

  try {
    resources.companyProvision = request.company_id
      ? null
      : await ensurePartnerCompanyRow(
          supabase,
          {
            companyId: null,
            name: request.company_name,
            description: request.company_description ?? null,
            contactName: request.contact_name,
            contactEmail: request.contact_email,
            contactPhone: request.contact_phone ?? null,
          },
          true,
          { managedCampusSlugs: normalizedCampusSlugs },
        );
    const companyId =
      request.company_id ?? resources.companyProvision?.company?.id ?? null;
    if (!companyId) {
      return { partners: [], created: false };
    }

    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("partner_brand_profiles")
      .select("id")
      .eq("company_id", companyId)
      .eq("name", request.brand_name)
      .maybeSingle();
    if (profileLookupError) {
      throw new Error(profileLookupError.message);
    }

    let brandProfileId =
      (existingProfile as { id?: string } | null)?.id ?? null;
    if (!brandProfileId) {
      const { data: createdProfile, error: profileCreateError } =
        await supabase
          .from("partner_brand_profiles")
          .insert({
            company_id: companyId,
            name: request.brand_name,
            category_id: request.category_id,
            category_label: request.category_label,
            description: request.detail_description ?? null,
            inquiry_link: request.inquiry_link ?? null,
            brand_phone: request.brand_phone ?? null,
            thumbnail_url: request.thumbnail_url ?? null,
            image_urls: request.image_urls ?? [],
            tags: request.tags ?? [],
          })
          .select("id")
          .single();
      if (profileCreateError) {
        throw new Error(profileCreateError.message);
      }
      brandProfileId = (createdProfile as { id: string }).id;
      resources.createdBrandProfileId = brandProfileId;
    }

    const [groupResult, branchResult] = await Promise.all([
      supabase
        .from("partner_registration_benefit_groups")
        .select("group_key,label,benefit_action_type,benefit_action_link,benefits,conditions,period_start,period_end,tags")
        .eq("registration_request_id", request.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("partner_registration_branches")
        .select("benefit_group_key,branch_key,branch_code,name,address,branch_type,campus_slugs,map_url,phone,memo")
        .eq("registration_request_id", request.id)
        .order("created_at", { ascending: true }),
    ]);
    if (groupResult.error) {
      throw new Error(groupResult.error.message);
    }
    if (branchResult.error) {
      throw new Error(branchResult.error.message);
    }

    const groups = (groupResult.data ?? []) as RegistrationBenefitGroupRow[];
    const safeGroups =
      groups.length > 0
        ? groups
        : [
            {
              group_key: DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
              label: DEFAULT_PARTNER_BENEFIT_GROUP_KEY,
              benefit_action_type: request.benefit_action_type,
              benefit_action_link: request.benefit_action_link,
              benefits: request.benefits ?? [],
              conditions: request.conditions ?? [],
              period_start: request.period_start ?? null,
              period_end: request.period_end ?? null,
              tags: request.tags ?? [],
            },
          ];
    const branches = (branchResult.data ?? []) as RegistrationBranchRow[];
    const createdPartners: ConvertedPartnerRow[] = [];

    for (const group of safeGroups) {
      const normalizedGroupKey = normalizeRegistrationBenefitGroupKey(
        group.group_key,
      );
      const groupBranches = branches.filter(
        (branch) =>
          normalizeRegistrationBenefitGroupKey(branch.benefit_group_key) ===
          normalizedGroupKey,
      );
      const groupCampusSlugs = normalizeCampusSlugs(
        groupBranches.flatMap((branch) => branch.campus_slugs ?? []),
      );
      const partnerCampusSlugs =
        groupCampusSlugs.length > 0 ? groupCampusSlugs : normalizedCampusSlugs;
      const locationSummary =
        groupBranches.length === 0
          ? request.location
          : groupBranches.length === 1
            ? groupBranches[0]!.address
            : `${groupBranches[0]!.address} 외 ${groupBranches.length - 1}개 지점`;
      const partnerName =
        safeGroups.length === 1 ||
        normalizedGroupKey === DEFAULT_PARTNER_BENEFIT_GROUP_KEY
          ? request.brand_name
          : `${request.brand_name} · ${group.label}`;
      const existingPartner = await findExistingConvertedPartner(supabase, {
        ...request,
        company_id: companyId,
        brand_name: partnerName,
        location: locationSummary,
      });
      if (existingPartner) {
        createdPartners.push(existingPartner);
        continue;
      }

      const partnerId = randomUUID();
      const benefitActionType =
        group.benefit_action_type ?? request.benefit_action_type;
      const benefitActionLink =
        group.benefit_action_link ??
        request.benefit_action_link ??
        (benefitActionType === "external_link"
          ? request.site_link ?? null
          : null);
      const { data, error } = await supabase
        .from("partners")
        .insert({
          id: partnerId,
          company_id: companyId,
          brand_profile_id: brandProfileId,
          name: partnerName,
          category_id: request.category_id,
          location: locationSummary,
          detail_description: request.detail_description ?? null,
          campus_slugs: partnerCampusSlugs,
          managed_campus_slugs: partnerCampusSlugs,
          map_url: groupBranches[0]?.map_url ?? request.map_url ?? null,
          benefit_action_type: benefitActionType,
          benefit_action_link: benefitActionLink,
          reservation_link: null,
          inquiry_link: request.inquiry_link ?? null,
          period_start: group.period_start ?? request.period_start ?? null,
          period_end: group.period_end ?? request.period_end ?? null,
          conditions: group.conditions ?? request.conditions ?? [],
          benefits: group.benefits ?? request.benefits ?? [],
          applies_to: ["staff", "student", "graduate"],
          thumbnail: request.thumbnail_url ?? null,
          images: request.image_urls ?? [],
          tags: group.tags ?? request.tags ?? [],
          visibility: request.visibility ?? "public",
          benefit_visibility: "public",
          branch_scope_type:
            request.service_mode === "online"
              ? "online"
              : request.branch_scope_type ?? "single_location",
          branch_scope_note: request.branch_scope_note ?? null,
          benefit_verification_pin_hash:
            request.benefit_verification_pin_hash ?? null,
          benefit_verification_pin_salt:
            request.benefit_verification_pin_salt ?? null,
        })
        .select("id,name,location,campus_slugs,visibility,benefits,conditions,period_start,period_end,map_url")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const createdPartner = data as ConvertedPartnerRow;
      createdPartners.push(createdPartner);
      resources.createdPartnerIds.push(createdPartner.id);

      const benefitItems = normalizePartnerBenefitItems(
        request.benefit_items ??
          (group.benefits ?? request.benefits ?? []).map((title, index) => ({
            id: `registration-benefit-${index + 1}`,
            title,
          })),
      );
      if (benefitItems.length > 0) {
        const { error: benefitError } = await supabase
          .from("partner_benefits")
          .insert(
            benefitItems.map((benefit, displayOrder) => ({
              partner_id: partnerId,
              title: benefit.title,
              max_apply_count: benefit.maxApplyCount ?? null,
              display_order: displayOrder,
            })),
          );
        if (benefitError) {
          throw new Error(benefitError.message);
        }
      }

      await persistPartnerBranchLinks({
        supabase,
        partnerId: createdPartner.id,
        companyId,
        brandProfileId,
        source:
          request.source === "partner_portal" ? "partner_portal" : "registration",
        branches: groupBranches.map((branch) => ({
          branchKey: branch.branch_key,
          branchCode: branch.branch_code ?? null,
          name: branch.name,
          address: branch.address,
          branchType: branch.branch_type ?? "unknown",
          campusSlugs: branch.campus_slugs ?? [],
          mapUrl: branch.map_url ?? null,
          phone: branch.phone ?? null,
          memo: branch.memo ?? null,
        })),
      });
    }

    return { partners: createdPartners, created: createdPartners.length > 0 };
  } catch (error) {
    try {
      await rollbackRegistrationConversionResources(supabase, resources);
    } catch (cleanupError) {
      throw new Error("partner_registration_conversion_cleanup_failed", {
        cause: { originalError: error, cleanupError },
      });
    }
    throw error;
  }
}

async function rollbackPartnerRegistrationRequestStatus({
  supabase,
  request,
  requestedStatus,
}: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  request: PartnerRegistrationRequestRow;
  requestedStatus: PartnerRegistrationRequestStatus;
}) {
  const previousStatus = isPartnerRegistrationRequestStatus(request.status)
    ? request.status
    : "pending";
  const previousVisibility =
    typeof request.visibility === "string" &&
    isPartnerVisibility(request.visibility)
      ? request.visibility
      : "public";
  const { data, error } = await supabase
    .from("partner_registration_requests")
    .update({
      status: previousStatus,
      visibility: previousVisibility,
      admin_note: request.admin_note ?? null,
      reviewed_by_admin_id: request.reviewed_by_admin_id ?? null,
      reviewed_at: request.reviewed_at ?? null,
    })
    .eq("id", request.id)
    .eq("status", requestedStatus)
    .select("id")
    .maybeSingle();

  return !error && Boolean(data);
}

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

  const payload: {
    status: PartnerRegistrationRequestStatus;
    visibility: "public" | "confidential" | "private";
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
    console.error(
      "[partner-registration] status update failed",
      updateError.message,
    );
    redirectAdminActionError(returnTo, "partner_form_invalid_request");
  }

  if (!updatedRequest) {
    redirect(appendAdminReviewQueueQuery(returnTo, { success: "already-updated" }));
  }

  let convertedPartnerId: string | null = null;
  if (status === "converted" && previousStatus !== "converted") {
    try {
      const conversion = await createPartnerFromPortalRegistrationRequest({
        supabase,
        request: { ...registrationRequest, visibility },
        campusSlugs: managedCampusSlugs,
      });
      if (conversion.partners.length === 0) {
        throw new Error("등록 가능한 제휴처가 생성되지 않았습니다.");
      }
      convertedPartnerId =
        conversion.partners.length === 1
          ? conversion.partners[0]?.id ?? null
          : null;

      for (const partner of conversion.partners) {
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
        }

        revalidatePartnerData();
        revalidateAdminAndPublicPaths(partner.id);
      }
    } catch (error) {
      const rollbackSucceeded = await rollbackPartnerRegistrationRequestStatus({
        supabase,
        request: registrationRequest,
        requestedStatus: status,
      });
      const message =
        error instanceof Error
          ? error.message
          : "제휴처 등록 신청 승인 후처리에 실패했습니다.";
      console.error("[partner-registration] converted follow-up failed", message);
      if (!rollbackSucceeded) {
        console.error(
          "[partner-registration] converted status rollback failed",
        );
      }
      revalidatePath("/admin/partner-registrations");
      redirectAdminActionError(returnTo, "partner_form_conversion_failed", {
        action: "partner_create",
        targetType: "partner_registration_request",
        targetId: registrationRequest.id,
        properties: {
          previousStatus,
          requestedStatus: status,
          stage: "conversion_follow_up",
        },
      });
    }
  }

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
  if (rawBenefitVerificationPin && !/^\d{4}$/.test(rawBenefitVerificationPin)) {
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
      console.error("[partner-registration] details group update failed", error.message);
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
    console.error("[partner-registration] details update failed", updateError.message);
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
