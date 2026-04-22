import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { buildAuditChangeSummary } from "@/lib/audit-change-summary";
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

  const approvalAudit = buildAuditChangeSummary("브랜드", [
    {
      label: "브랜드명",
      before: request.currentPartnerName,
      after: request.requestedPartnerName,
    },
    {
      label: "위치",
      before: request.currentPartnerLocation,
      after: request.requestedPartnerLocation,
    },
    {
      label: "지도 링크",
      before: request.currentMapUrl ?? null,
      after: request.requestedMapUrl ?? null,
      format: (value) => (value ? String(value) : "없음"),
    },
    {
      label: "이용조건",
      before: request.currentConditions,
      after: request.requestedConditions,
    },
    {
      label: "이용혜택",
      before: request.currentBenefits,
      after: request.requestedBenefits,
    },
    {
      label: "노출 대상",
      before: request.currentAppliesTo,
      after: request.requestedAppliesTo,
    },
    {
      label: "태그",
      before: request.currentTags,
      after: request.requestedTags,
    },
    {
      label: "메인 썸네일",
      before: request.currentThumbnail ?? null,
      after: request.requestedThumbnail ?? null,
      format: (value) => (value ? String(value) : "없음"),
    },
    {
      label: "추가 이미지",
      before: request.currentImages,
      after: request.requestedImages,
      format: (value) => (Array.isArray(value) ? `${value.length}장` : "0장"),
    },
    {
      label: "예약 링크",
      before: request.currentReservationLink ?? null,
      after: request.requestedReservationLink ?? null,
      format: (value) => (value ? String(value) : "없음"),
    },
    {
      label: "문의 링크",
      before: request.currentInquiryLink ?? null,
      after: request.requestedInquiryLink ?? null,
      format: (value) => (value ? String(value) : "없음"),
    },
    {
      label: "제휴 시작일",
      before: request.currentPeriodStart ?? null,
      after: request.requestedPeriodStart ?? null,
    },
    {
      label: "제휴 종료일",
      before: request.currentPeriodEnd ?? null,
      after: request.requestedPeriodEnd ?? null,
    },
  ]);

  await logAdminAction("partner_change_request_approve", {
    targetType: "partner_change_request",
    targetId: request.id,
    properties: {
      summary: approvalAudit.summary,
      changedFields: approvalAudit.changedFields,
      changes: approvalAudit.changes,
      fieldChanges: approvalAudit.fieldChanges,
      partnerId: request.partnerId,
      partnerName: request.partnerName,
      companyId: request.companyId,
      companyName: request.companyName,
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
