import type {
  PartnerNotificationCenterSummary,
  PartnerNotificationEntry,
} from "@/lib/partner-notifications";

function truncateText(value: string, limit = 80) {
  const trimmed = value.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit - 1)}…`;
}

function getOperationSummaryText(properties: Record<string, unknown> | null) {
  const normalized = properties ?? {};
  const summary = normalized.summary;
  if (typeof summary === "string" && summary.trim()) {
    return summary.trim();
  }

  const changes = normalized.changes;
  if (!Array.isArray(changes)) {
    return null;
  }

  const text = changes
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");

  return text || null;
}

export function createReviewEntry(review: {
  id: string;
  partnerId: string;
  partnerName: string;
  companyId: string | null;
  companyName: string | null;
  rating: number;
  title: string;
  body: string;
  authorMaskedName: string;
  authorRoleLabel: string;
  createdAt: string;
}): PartnerNotificationEntry {
  return {
    id: `review:${review.id}`,
    category: "review",
    status: "created",
    tone: "primary",
    badgeLabel: "새 리뷰",
    title: `${review.partnerName}에 새 리뷰가 등록되었습니다`,
    body: `${review.rating}점 · ${truncateText(review.title || review.body || "리뷰", 60)} · ${review.authorMaskedName} (${review.authorRoleLabel})`,
    companyId: review.companyId,
    companyName: review.companyName ?? "미지정",
    partnerId: review.partnerId,
    partnerName: review.partnerName,
    href: `/partner/services/${encodeURIComponent(review.partnerId)}`,
    createdAt: review.createdAt,
  };
}

export function createOperationEntry(input: {
  id: string;
  action: string;
  properties: Record<string, unknown> | null;
  createdAt: string;
  companyId: string | null;
  companyName: string;
  partnerId: string | null;
  partnerName: string | null;
  reviewTitle?: string | null;
}): PartnerNotificationEntry | null {
  const summaryText = getOperationSummaryText(input.properties);

  switch (input.action) {
    case "partner_company_create":
      return {
        id: `audit:${input.id}`,
        category: "operation",
        status: "created",
        tone: "success",
        badgeLabel: "협력사",
        title: `${input.companyName} 협력사가 등록되었습니다`,
        body: summaryText ?? "협력사 정보가 새로 등록되었습니다.",
        companyId: input.companyId,
        companyName: input.companyName,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        href: "/partner",
        createdAt: input.createdAt,
      };
    case "partner_company_update":
      return {
        id: `audit:${input.id}`,
        category: "operation",
        status: "updated",
        tone: "primary",
        badgeLabel: "협력사",
        title: `${input.companyName} 협력사 정보가 수정되었습니다`,
        body: summaryText ?? "협력사 정보가 수정되었습니다.",
        companyId: input.companyId,
        companyName: input.companyName,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        href: "/partner",
        createdAt: input.createdAt,
      };
    case "partner_company_delete":
      return {
        id: `audit:${input.id}`,
        category: "operation",
        status: "deleted",
        tone: "danger",
        badgeLabel: "협력사",
        title: `${input.companyName} 협력사가 삭제되었습니다`,
        body: summaryText ?? "협력사 정보가 삭제되었습니다.",
        companyId: input.companyId,
        companyName: input.companyName,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        href: "/partner",
        createdAt: input.createdAt,
      };
    case "partner_create":
      return {
        id: `audit:${input.id}`,
        category: "operation",
        status: "created",
        tone: "success",
        badgeLabel: "브랜드",
        title: `${input.partnerName ?? "브랜드"}가 등록되었습니다`,
        body:
          summaryText ??
          (input.companyName ? `${input.companyName} 소속 브랜드가 새로 등록되었습니다.` : "브랜드 정보가 새로 등록되었습니다."),
        companyId: input.companyId,
        companyName: input.companyName,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        href: input.partnerId
          ? `/partner/services/${encodeURIComponent(input.partnerId)}`
          : "/partner",
        createdAt: input.createdAt,
      };
    case "partner_update":
      return {
        id: `audit:${input.id}`,
        category: "operation",
        status: "updated",
        tone: "primary",
        badgeLabel: "브랜드",
        title: `${input.partnerName ?? "브랜드"} 정보가 수정되었습니다`,
        body: summaryText ?? "브랜드 정보가 수정되었습니다.",
        companyId: input.companyId,
        companyName: input.companyName,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        href: input.partnerId
          ? `/partner/services/${encodeURIComponent(input.partnerId)}`
          : "/partner",
        createdAt: input.createdAt,
      };
    case "partner_delete":
      return {
        id: `audit:${input.id}`,
        category: "operation",
        status: "deleted",
        tone: "danger",
        badgeLabel: "브랜드",
        title: `${input.partnerName ?? "브랜드"}가 삭제되었습니다`,
        body: summaryText ?? "브랜드 정보가 삭제되었습니다.",
        companyId: input.companyId,
        companyName: input.companyName,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        href: "/partner",
        createdAt: input.createdAt,
      };
    case "partner_review_hide":
      return {
        id: `audit:${input.id}`,
        category: "operation",
        status: "hidden",
        tone: "warning",
        badgeLabel: "리뷰",
        title: `${input.partnerName ?? "브랜드"} 리뷰가 숨김 처리되었습니다`,
        body: summaryText ?? input.reviewTitle ?? "운영 판단으로 리뷰가 숨김 처리되었습니다.",
        companyId: input.companyId,
        companyName: input.companyName,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        href: input.partnerId
          ? `/partner/services/${encodeURIComponent(input.partnerId)}`
          : "/partner",
        createdAt: input.createdAt,
      };
    case "partner_review_restore":
      return {
        id: `audit:${input.id}`,
        category: "operation",
        status: "restored",
        tone: "success",
        badgeLabel: "리뷰",
        title: `${input.partnerName ?? "브랜드"} 리뷰 숨김이 해제되었습니다`,
        body: summaryText ?? "숨겨졌던 리뷰가 다시 노출됩니다.",
        companyId: input.companyId,
        companyName: input.companyName,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        href: input.partnerId
          ? `/partner/services/${encodeURIComponent(input.partnerId)}`
          : "/partner",
        createdAt: input.createdAt,
      };
    case "partner_review_update":
      return {
        id: `audit:${input.id}`,
        category: "operation",
        status: "updated",
        tone: "primary",
        badgeLabel: "리뷰",
        title: `${input.partnerName ?? "브랜드"} 리뷰가 수정되었습니다`,
        body: summaryText ?? input.reviewTitle ?? "리뷰 내용이 수정되었습니다.",
        companyId: input.companyId,
        companyName: input.companyName,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        href: input.partnerId
          ? `/partner/services/${encodeURIComponent(input.partnerId)}`
          : "/partner",
        createdAt: input.createdAt,
      };
    case "partner_review_delete":
      return {
        id: `audit:${input.id}`,
        category: "operation",
        status: "deleted",
        tone: "danger",
        badgeLabel: "리뷰",
        title: `${input.partnerName ?? "브랜드"} 리뷰가 삭제되었습니다`,
        body: summaryText ?? input.reviewTitle ?? "리뷰가 삭제되었습니다.",
        companyId: input.companyId,
        companyName: input.companyName,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        href: input.partnerId
          ? `/partner/services/${encodeURIComponent(input.partnerId)}`
          : "/partner",
        createdAt: input.createdAt,
      };
    case "partner_account_create":
      return {
        id: `audit:${input.id}`,
        category: "operation",
        status: "created",
        tone: "success",
        badgeLabel: "계정",
        title: "협력사 계정이 생성되었습니다",
        body: summaryText ?? "협력사 계정이 새로 만들어졌습니다.",
        companyId: input.companyId,
        companyName: input.companyName,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        href: "/partner",
        createdAt: input.createdAt,
      };
    case "partner_account_update":
      return {
        id: `audit:${input.id}`,
        category: "operation",
        status: "updated",
        tone: "primary",
        badgeLabel: "계정",
        title: "협력사 계정 정보가 수정되었습니다",
        body: summaryText ?? "계정 정보가 수정되었습니다.",
        companyId: input.companyId,
        companyName: input.companyName,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        href: "/partner",
        createdAt: input.createdAt,
      };
    case "partner_account_company_update":
      return {
        id: `audit:${input.id}`,
        category: "operation",
        status: "granted",
        tone: "warning",
        badgeLabel: "권한",
        title: "협력사 접근 권한이 변경되었습니다",
        body: summaryText ?? "연결된 협력사 권한이 변경되었습니다.",
        companyId: input.companyId,
        companyName: input.companyName,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        href: "/partner",
        createdAt: input.createdAt,
      };
    default:
      return null;
  }
}

export function sortEntries(entries: PartnerNotificationEntry[]) {
  return [...entries].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}

export function buildSummary(
  items: PartnerNotificationEntry[],
  companyCount: number,
  serviceCount: number,
): PartnerNotificationCenterSummary {
  const requestCount = items.filter((item) => item.category === "request").length;
  const pendingRequestCount = items.filter(
    (item) => item.category === "request" && item.status === "pending",
  ).length;
  const resolvedRequestCount = requestCount - pendingRequestCount;
  const reviewCount = items.filter((item) => item.category === "review").length;
  const operationCount = items.filter((item) => item.category === "operation").length;

  return {
    totalCount: items.length,
    requestCount,
    pendingRequestCount,
    resolvedRequestCount,
    reviewCount,
    operationCount,
    companyCount,
    serviceCount,
  };
}
