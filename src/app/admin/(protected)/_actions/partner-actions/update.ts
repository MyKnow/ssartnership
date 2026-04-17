import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { deletePartnerMediaUrls } from "@/lib/partner-media-storage";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  cleanupPartnerCompanyProvision,
  collectPartnerMediaUrls,
  ensurePartnerCompanyRow,
  resolvePartnerMediaPayload,
} from "@/app/admin/(protected)/_actions/partner-support";
import {
  logAdminAction,
  revalidateAdminAndPublicPaths,
  revalidatePartnerData,
} from "@/app/admin/(protected)/_actions/shared-helpers";
import {
  parsePartnerCompanyPayloadOrRedirect,
  parsePartnerPayloadOrRedirect,
} from "@/app/admin/(protected)/_actions/shared-parser-redirects";

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
