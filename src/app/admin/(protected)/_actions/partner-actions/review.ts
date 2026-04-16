import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  approvePartnerChangeRequest as approvePartnerChangeRequestRecord,
  rejectPartnerChangeRequest as rejectPartnerChangeRequestRecord,
} from "@/lib/partner-change-requests";
import {
  logAdminAction,
  redirectAdminActionError,
  revalidateAdminAndPublicPaths,
  revalidatePartnerData,
  revalidatePartnerPortalPaths,
} from "@/app/admin/(protected)/_actions/shared-helpers";

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
