import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { deletePartnerMediaUrls } from "@/lib/partner-media-storage";
import {
  createNewPartnerPayload,
  isPushConfigured,
} from "@/lib/push";
import { sendAdminNotificationCampaign } from "@/lib/admin-notification-ops";
import type { PartnerCreateFormState } from "@/lib/partner-form-state";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  cleanupPartnerCompanyProvision,
  ensurePartnerCompanyRow,
  resolvePartnerMediaPayload,
} from "@/app/admin/(protected)/_actions/partner-support";
import {
  logAdminAction,
  revalidateAdminAndPublicPaths,
  revalidatePartnerData,
} from "@/app/admin/(protected)/_actions/shared-helpers";
import {
  parsePartnerCompanyPayload,
  parsePartnerPayload,
} from "@/app/admin/(protected)/_actions/shared-parsers";
import type { CreatedPartnerRecord } from "@/app/admin/(protected)/_actions/shared-types";

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
      campus_slugs: payload.campusSlugs,
      map_url: payload.mapUrl,
      benefit_action_type: payload.benefitActionType,
      benefit_action_link: payload.benefitActionLink,
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
      benefit_visibility: payload.benefitVisibility,
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
      categoryId: payload.categoryId,
      location: payload.location,
      campusSlugs: payload.campusSlugs,
      hasMapUrl: Boolean(payload.mapUrl),
      benefitActionType: payload.benefitActionType,
      hasBenefitActionLink: Boolean(payload.benefitActionLink),
      hasReservationLink: Boolean(payload.reservationLink),
      hasInquiryLink: Boolean(payload.inquiryLink),
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      conditionCount: payload.conditions.length,
      visibility: payload.visibility,
      benefitVisibility: payload.benefitVisibility,
      benefitCount: payload.benefits.length,
      appliesTo: payload.appliesTo,
      hasThumbnail: Boolean(media.thumbnail),
      imageCount: media.images.length,
      tagCount: payload.tags.length,
    },
  });

  if (payload.visibility !== "private") {
    const { data: category } = await supabase
      .from("categories")
      .select("label")
      .eq("id", payload.categoryId)
      .maybeSingle();

    try {
      const notificationPayload = createNewPartnerPayload({
        partnerId,
        name: payload.name,
        location: payload.location,
        categoryLabel: category?.label ?? null,
      });
      await sendAdminNotificationCampaign(
        {
          notificationType: "new_partner",
          title: notificationPayload.title,
          body: notificationPayload.body,
          url: notificationPayload.url,
          audience: { scope: "all" },
          channels: {
            in_app: true,
            push: isPushConfigured(),
            mm: false,
          },
        },
        "automatic",
      );
    } catch (pushError) {
      console.error("new partner push failed", pushError);
    }
  }

  revalidatePartnerData();
  revalidateAdminAndPublicPaths(partnerId);
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
