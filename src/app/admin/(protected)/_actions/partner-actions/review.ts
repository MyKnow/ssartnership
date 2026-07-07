import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  assertAdminCanAccessManagedCampuses,
  type AdminScopeAccountLike,
} from "@/lib/admin-scope";
import { buildAuditChangeSummary } from "@/lib/audit-change-summary";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
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

async function assertCanReviewPartnerChangeRequest(
  account: AdminScopeAccountLike,
  requestId: string,
) {
  const supabase = getSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("partner_change_requests")
    .select("partner_id")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError || !request?.partner_id) {
    redirectAdminActionError("/admin/partners", "partner_form_invalid_request");
  }

  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select("managed_campus_slugs")
    .eq("id", request.partner_id)
    .maybeSingle();

  if (partnerError || !partner) {
    redirectAdminActionError("/admin/partners", "partner_form_invalid_request");
  }

  try {
    assertAdminCanAccessManagedCampuses(
      account,
      (partner as { managed_campus_slugs?: string[] | null }).managed_campus_slugs,
    );
  } catch {
    redirectAdminActionError("/admin/partners", "regional_admin_scope_denied");
  }
}

export async function approvePartnerChangeRequestAction(formData: FormData) {
  const adminSession = await requireAdminPermission("brands", "update", {
    path: "/admin/partners",
  });
  const requestId = String(formData.get("requestId") || "").trim();
  if (!requestId) {
    redirectAdminActionError("/admin/partners", "partner_form_invalid_request");
  }
  await assertCanReviewPartnerChangeRequest(adminSession.account, requestId);

  const request = await approvePartnerChangeRequestRecord({
    requestId,
    adminId: adminSession.adminId,
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
      label: "혜택 이용",
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
    targetType: "partner",
    targetId: request.partnerId,
    properties: {
      requestId: request.id,
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
  const adminSession = await requireAdminPermission("brands", "update", {
    path: "/admin/partners",
  });
  const requestId = String(formData.get("requestId") || "").trim();
  if (!requestId) {
    redirectAdminActionError("/admin/partners", "partner_form_invalid_request");
  }
  await assertCanReviewPartnerChangeRequest(adminSession.account, requestId);

  const request = await rejectPartnerChangeRequestRecord({
    requestId,
    adminId: adminSession.adminId,
  });

  await logAdminAction("partner_change_request_reject", {
    targetType: "partner",
    targetId: request.partnerId,
    properties: {
      requestId: request.id,
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
