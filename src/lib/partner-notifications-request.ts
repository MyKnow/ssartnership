import { buildAuditChangeSummary } from "@/lib/audit-change-summary";
import type {
  PartnerChangeRequestStatus,
  PartnerChangeRequestSummary,
} from "@/lib/partner-change-requests/shared";
import type {
  PartnerNotificationEntry,
  PartnerNotificationTone,
} from "@/lib/partner-notifications";

function formatPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
) {
  const left = start?.trim() || "미정";
  const right = end?.trim() || "미정";
  return `${left} ~ ${right}`;
}

export function summarizeRequestChanges(summary: PartnerChangeRequestSummary) {
  return buildAuditChangeSummary("브랜드", [
    { label: "브랜드명", before: summary.currentPartnerName, after: summary.requestedPartnerName },
    { label: "위치", before: summary.currentPartnerLocation, after: summary.requestedPartnerLocation },
    { label: "지도 URL", before: summary.currentMapUrl, after: summary.requestedMapUrl },
    { label: "이용조건", before: summary.currentConditions, after: summary.requestedConditions },
    { label: "이용혜택", before: summary.currentBenefits, after: summary.requestedBenefits },
    { label: "노출 대상", before: summary.currentAppliesTo, after: summary.requestedAppliesTo },
    { label: "태그", before: summary.currentTags, after: summary.requestedTags },
    { label: "메인 썸네일", before: summary.currentThumbnail, after: summary.requestedThumbnail },
    { label: "추가 이미지", before: summary.currentImages, after: summary.requestedImages },
    {
      label: "혜택 이용",
      before: summary.currentReservationLink,
      after: summary.requestedReservationLink,
    },
    { label: "문의 링크", before: summary.currentInquiryLink, after: summary.requestedInquiryLink },
    {
      label: "제휴 기간",
      before: formatPeriod(summary.currentPeriodStart, summary.currentPeriodEnd),
      after: formatPeriod(summary.requestedPeriodStart, summary.requestedPeriodEnd),
    },
  ]);
}

export function createRequestEntry(summary: PartnerChangeRequestSummary): PartnerNotificationEntry {
  const requestChanges = summarizeRequestChanges(summary);
  const requesterLabel =
    summary.requestedByDisplayName?.trim() ||
    summary.requestedByLoginId?.trim() ||
    "담당자";
  const changePreview = requestChanges.changes.slice(0, 3).join(" · ");
  const resolvedAt = summary.reviewedAt ?? summary.cancelledAt ?? summary.updatedAt;

  const statusLabelMap: Record<PartnerChangeRequestStatus, string> = {
    pending: "요청 대기",
    approved: "승인 완료",
    rejected: "반려됨",
    cancelled: "취소됨",
  };
  const toneMap: Record<PartnerChangeRequestStatus, PartnerNotificationTone> = {
    pending: "warning",
    approved: "success",
    rejected: "danger",
    cancelled: "neutral",
  };
  const bodyByStatus: Record<PartnerChangeRequestStatus, string> = {
    pending: `${requesterLabel}이(가) ${summary.companyName}에 브랜드 수정 요청을 보냈습니다.${
      changePreview ? ` ${changePreview}` : ""
    }`,
    approved: `${summary.companyName}의 브랜드 수정 요청이 승인되었습니다.${
      changePreview ? ` ${changePreview}` : ""
    }`,
    rejected: `${summary.companyName}의 브랜드 수정 요청이 반려되었습니다.${
      changePreview ? ` ${changePreview}` : ""
    }`,
    cancelled: `${summary.companyName}의 브랜드 수정 요청이 취소되었습니다.${
      changePreview ? ` ${changePreview}` : ""
    }`,
  };

  return {
    id: `request:${summary.id}`,
    category: "request",
    status: summary.status,
    tone: toneMap[summary.status],
    badgeLabel: statusLabelMap[summary.status],
    title: `${summary.requestedPartnerName} 수정 요청`,
    body: bodyByStatus[summary.status],
    companyId: summary.companyId,
    companyName: summary.companyName,
    partnerId: summary.partnerId,
    partnerName: summary.requestedPartnerName,
    href: `/partner/services/${encodeURIComponent(summary.partnerId)}`,
    createdAt: resolvedAt,
  };
}
