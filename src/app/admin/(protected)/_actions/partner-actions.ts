import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createNewPartnerPayload, isPushConfigured, sendPushToAudience } from "@/lib/push";
import { isWithinPeriod } from "@/lib/partner-utils";
import type { PartnerCreateFormState } from "@/lib/partner-form-state";
import {
  approvePartnerChangeRequest as approvePartnerChangeRequestRecord,
  rejectPartnerChangeRequest as rejectPartnerChangeRequestRecord,
} from "@/lib/partner-change-requests";
import {
  cleanupPartnerCompanyProvision,
  collectPartnerMediaUrls,
  ensurePartnerCompanyRow,
  resolvePartnerMediaPayload,
} from "./partner-support";
import {
  logAdminAction,
  redirectAdminActionError,
  revalidateAdminAndPublicPaths,
  revalidatePartnerData,
  revalidatePartnerPortalPaths,
} from "./shared-helpers";
import {
  parsePartnerCompanyPayload,
  parsePartnerCompanyPayloadOrRedirect,
  parsePartnerPayload,
  parsePartnerPayloadOrRedirect,
} from "./shared-parsers";
import type { CreatedPartnerRecord } from "./shared-types";
import { deletePartnerMediaUrls } from "@/lib/partner-media-storage";

async function createPartnerRecord(formData: FormData): Promise<CreatedPartnerRecord> {
  const payload = parsePartnerPayload(formData);
  const partnerId = randomUUID();
  const companyPayload = parsePartnerCompanyPayload(formData);
  const media = await resolvePartnerMediaPayload(formData, partnerId);

  const supabase = getSupabaseAdminClient();
  let companyProvision = null;

  try {
    companyProvision = await ensurePartnerCompanyRow(supabase, companyPayload, false);

    const { error } = await supabase.from("partners").insert({
      id: partnerId,
      company_id: companyProvision.company?.id ?? null,
      name: payload.name,
      category_id: payload.categoryId,
      location: payload.location,
      map_url: payload.mapUrl,
      reservation_link: payload.reservationLink,
      inquiry_link: payload.inquiryLink,
      period_start: payload.periodStart,
      period_end: payload.periodEnd,
      conditions: payload.conditions,
      benefits: payload.benefits,
      applies_to: payload.appliesTo,
      thumbnail: media.thumbnail,
      images: media.images,
      tags: payload.tags,
      visibility: payload.visibility,
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    await deletePartnerMediaUrls(media.uploadedUrls).catch(() => undefined);
    await cleanupPartnerCompanyProvision(supabase, companyProvision);
    throw error;
  }

  return {
    partnerId,
    payload,
    companyProvision,
    media,
    supabase,
  };
}

async function finalizeCreatedPartner(record: CreatedPartnerRecord) {
  const { partnerId, payload, companyProvision, media, supabase } = record;

  await logAdminAction("partner_create", {
    targetType: "partner",
    targetId: partnerId,
    properties: {
      name: payload.name,
      companyId: companyProvision?.company?.id ?? null,
      companyName: companyProvision?.company?.name ?? null,
      companyContactEmail: companyProvision?.company?.contact_email ?? null,
      categoryId: payload.categoryId,
      location: payload.location,
      hasMapUrl: Boolean(payload.mapUrl),
      hasReservationLink: Boolean(payload.reservationLink),
      hasInquiryLink: Boolean(payload.inquiryLink),
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      conditionCount: payload.conditions.length,
      visibility: payload.visibility,
      benefitCount: payload.benefits.length,
      appliesTo: payload.appliesTo,
      hasThumbnail: Boolean(media.thumbnail),
      imageCount: media.images.length,
      tagCount: payload.tags.length,
    },
  });

  if (
    payload.visibility !== "private" &&
    isPushConfigured() &&
    isWithinPeriod(payload.periodStart, payload.periodEnd)
  ) {
    const { data: category } = await supabase
      .from("categories")
      .select("label")
      .eq("id", payload.categoryId)
      .maybeSingle();

    try {
      await sendPushToAudience(
        createNewPartnerPayload({
          partnerId,
          name: payload.name,
          location: payload.location,
          categoryLabel: category?.label ?? null,
        }),
      );
    } catch (pushError) {
      console.error("new partner push failed", pushError);
    }
  }

  revalidatePartnerData();
  revalidateAdminAndPublicPaths(partnerId);
}

export async function createPartnerAction(formData: FormData) {
  await requireAdmin();
  const record = await createPartnerRecord(formData);
  await finalizeCreatedPartner(record);
  redirect("/admin/partners?created=partner_created");
}

export async function createPartnerFormActionImpl(
  _prevState: PartnerCreateFormState,
  formData: FormData,
): Promise<PartnerCreateFormState> {
  await requireAdmin();
  try {
    const record = await createPartnerRecord(formData);
    await finalizeCreatedPartner(record);
  } catch (error) {
    return {
      status: "error",
      errorCode:
        error instanceof Error ? error.message : "partner_form_invalid_request",
    };
  }

  redirect("/admin/partners?created=partner_created");
}

export async function updatePartnerAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    throw new Error("수정할 업체를 찾을 수 없습니다.");
  }

  const payload = parsePartnerPayloadOrRedirect(formData, "/admin/partners");
  const supabase = getSupabaseAdminClient();
  const { data: previousPartner, error: previousPartnerError } = await supabase
    .from("partners")
    .select("company_id,thumbnail,images")
    .eq("id", id)
    .maybeSingle();

  if (previousPartnerError) {
    throw new Error(previousPartnerError.message);
  }
  if (!previousPartner) {
    throw new Error("수정할 업체를 찾을 수 없습니다.");
  }

  const companyPayload = parsePartnerCompanyPayloadOrRedirect(
    formData,
    "/admin/partners",
  );
  const media = await resolvePartnerMediaPayload(formData, id);
  const hasCompanyPayload = Boolean(
    companyPayload.companyId ||
      companyPayload.name ||
      companyPayload.description ||
      companyPayload.contactName ||
      companyPayload.contactEmail ||
      companyPayload.contactPhone,
  );
  let companyProvision = null;
  let nextCompanyId = previousPartner.company_id ?? null;

  if (hasCompanyPayload) {
    companyProvision = await ensurePartnerCompanyRow(
      supabase,
      companyPayload,
      Boolean(previousPartner.company_id || hasCompanyPayload),
    );
    if (companyProvision.company) {
      nextCompanyId = companyProvision.company.id;
    }
  }

  try {
    const { error } = await supabase
      .from("partners")
      .update({
        company_id: nextCompanyId,
        name: payload.name,
        category_id: payload.categoryId,
        location: payload.location,
        map_url: payload.mapUrl,
        reservation_link: payload.reservationLink,
        inquiry_link: payload.inquiryLink,
        period_start: payload.periodStart,
        period_end: payload.periodEnd,
        conditions: payload.conditions,
        benefits: payload.benefits,
        applies_to: payload.appliesTo,
        thumbnail: media.thumbnail,
        images: media.images,
        tags: payload.tags,
        visibility: payload.visibility,
      })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    await deletePartnerMediaUrls(media.uploadedUrls).catch(() => undefined);
    await cleanupPartnerCompanyProvision(supabase, companyProvision);
    throw error;
  }

  const previousUrls = collectPartnerMediaUrls(previousPartner);
  const nextUrls = collectPartnerMediaUrls({
    thumbnail: media.thumbnail,
    images: media.images,
  });
  const removedUrls = previousUrls.filter((url) => !nextUrls.includes(url));
  await deletePartnerMediaUrls(removedUrls).catch(() => undefined);

  await logAdminAction("partner_update", {
    targetType: "partner",
    targetId: id,
    properties: {
      name: payload.name,
      companyId: nextCompanyId,
      companyName: companyProvision?.company?.name ?? null,
      companyContactEmail: companyProvision?.company?.contact_email ?? null,
      categoryId: payload.categoryId,
      location: payload.location,
      hasMapUrl: Boolean(payload.mapUrl),
      hasReservationLink: Boolean(payload.reservationLink),
      hasInquiryLink: Boolean(payload.inquiryLink),
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      conditionCount: payload.conditions.length,
      visibility: payload.visibility,
      benefitCount: payload.benefits.length,
      appliesTo: payload.appliesTo,
      hasThumbnail: Boolean(media.thumbnail),
      imageCount: media.images.length,
      tagCount: payload.tags.length,
    },
  });
  revalidatePartnerData();
  revalidateAdminAndPublicPaths(id);
  redirect("/admin/partners");
}

export async function approvePartnerChangeRequestAction(formData: FormData) {
  await requireAdmin();
  const requestId = String(formData.get("requestId") || "").trim();
  if (!requestId) {
    redirectAdminActionError("/admin/partners", "partner_form_invalid_request");
  }

  const request = await approvePartnerChangeRequestRecord({
    requestId,
    adminId: process.env.ADMIN_ID ?? "admin",
  });

  await logAdminAction("partner_change_request_approve", {
    targetType: "partner_change_request",
    targetId: request.id,
    properties: {
      partnerId: request.partnerId,
      partnerName: request.partnerName,
      companyId: request.companyId,
      companyName: request.companyName,
      requestedConditionsCount: request.requestedConditions.length,
      requestedBenefitsCount: request.requestedBenefits.length,
      requestedTagsCount: request.requestedTags.length,
      requestedAppliesTo: request.requestedAppliesTo,
      requestedThumbnail: Boolean(request.requestedThumbnail),
      requestedImagesCount: request.requestedImages.length,
      requestedReservationLink: Boolean(request.requestedReservationLink),
      requestedInquiryLink: Boolean(request.requestedInquiryLink),
      requestedPeriodStart: request.requestedPeriodStart,
      requestedPeriodEnd: request.requestedPeriodEnd,
    },
  });

  revalidatePartnerData();
  revalidateAdminAndPublicPaths(request.partnerId);
  revalidatePartnerPortalPaths(request.partnerId);
  redirect("/admin/partners");
}

export async function rejectPartnerChangeRequestAction(formData: FormData) {
  await requireAdmin();
  const requestId = String(formData.get("requestId") || "").trim();
  if (!requestId) {
    redirectAdminActionError("/admin/partners", "partner_form_invalid_request");
  }

  const request = await rejectPartnerChangeRequestRecord({
    requestId,
    adminId: process.env.ADMIN_ID ?? "admin",
  });

  await logAdminAction("partner_change_request_reject", {
    targetType: "partner_change_request",
    targetId: request.id,
    properties: {
      partnerId: request.partnerId,
      partnerName: request.partnerName,
      companyId: request.companyId,
      companyName: request.companyName,
      requestedTagsCount: request.requestedTags.length,
      requestedThumbnail: Boolean(request.requestedThumbnail),
      requestedImagesCount: request.requestedImages.length,
      requestedReservationLink: Boolean(request.requestedReservationLink),
      requestedInquiryLink: Boolean(request.requestedInquiryLink),
      requestedPeriodStart: request.requestedPeriodStart,
      requestedPeriodEnd: request.requestedPeriodEnd,
    },
  });

  revalidatePartnerData();
  revalidateAdminAndPublicPaths(request.partnerId);
  revalidatePartnerPortalPaths(request.partnerId);
  redirect("/admin/partners");
}

export async function deletePartnerAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    redirectAdminActionError("/admin/partners", "partner_form_invalid_request");
  }

  const supabase = getSupabaseAdminClient();
  const { data: previousPartner, error: previousPartnerError } = await supabase
    .from("partners")
    .select("thumbnail,images")
    .eq("id", id)
    .maybeSingle();

  if (previousPartnerError) {
    redirectAdminActionError("/admin/partners", "partner_form_invalid_request");
  }

  const { error } = await supabase.from("partners").delete().eq("id", id);
  if (error) {
    redirectAdminActionError("/admin/partners", "partner_form_invalid_request");
  }

  await deletePartnerMediaUrls(collectPartnerMediaUrls(previousPartner)).catch(
    () => undefined,
  );

  await logAdminAction("partner_delete", {
    targetType: "partner",
    targetId: id,
  });
  revalidatePartnerData();
  revalidateAdminAndPublicPaths(id);
}
