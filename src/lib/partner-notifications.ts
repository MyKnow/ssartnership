import { buildAuditChangeSummary } from "@/lib/audit-change-summary";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import { partnerReviewRepository } from "@/lib/repositories";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  REQUEST_SELECT,
  type PartnerChangeRequestRow,
  type PartnerChangeRequestStatus,
  type PartnerChangeRequestSummary,
} from "@/lib/partner-change-requests/shared";
import { toSummary as toPartnerChangeRequestSummary } from "@/lib/partner-change-requests/summary";
import { getStore as getMockPartnerChangeRequestStore } from "@/lib/mock/partner-change-requests/service-store";
import { listMockPartnerPortalCompanySetups } from "@/lib/mock/partner-portal/store";
import {
  getPartnerReviewAuthorRoleLabel,
  maskPartnerReviewAuthorName,
} from "@/lib/partner-reviews";

export type PartnerNotificationCategory = "request" | "review" | "operation";

export type PartnerNotificationTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger";

export type PartnerNotificationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "created"
  | "updated"
  | "deleted"
  | "hidden"
  | "restored"
  | "granted";

export type PartnerNotificationEntry = {
  id: string;
  category: PartnerNotificationCategory;
  status: PartnerNotificationStatus;
  tone: PartnerNotificationTone;
  badgeLabel: string;
  title: string;
  body: string;
  companyId: string | null;
  companyName: string;
  partnerId: string | null;
  partnerName: string | null;
  href: string | null;
  createdAt: string;
};

export type PartnerNotificationCenterSummary = {
  totalCount: number;
  requestCount: number;
  pendingRequestCount: number;
  resolvedRequestCount: number;
  reviewCount: number;
  operationCount: number;
  companyCount: number;
  serviceCount: number;
};

export type PartnerNotificationCenterData = {
  summary: PartnerNotificationCenterSummary;
  items: PartnerNotificationEntry[];
  warningMessage: string | null;
};

type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
};

type PartnerServiceRow = {
  id: string;
  company_id?: string | null;
  name: string;
  location: string;
};

type PartnerReviewRow = {
  id: string;
  partner_id: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  hidden_at: string | null;
  partner?:
    | {
        id: string;
        name: string;
        company_id: string | null;
        company?:
          | {
              id: string;
              name: string;
              slug: string;
            }
          | {
              id: string;
              name: string;
              slug: string;
            }[]
          | null;
      }
    | {
        id: string;
        name: string;
        company_id: string | null;
        company?:
          | {
              id: string;
              name: string;
              slug: string;
            }
          | {
              id: string;
              name: string;
              slug: string;
            }[]
          | null;
      }[]
    | null;
  member?:
    | {
        display_name: string | null;
        mm_username: string | null;
        year: number | null;
      }
    | {
        display_name: string | null;
        mm_username: string | null;
        year: number | null;
      }[]
    | null;
};

type PartnerAuditLogRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
};

function normalizeIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

function truncateText(value: string, limit = 80) {
  const trimmed = value.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit - 1)}…`;
}

function formatPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
) {
  const left = start?.trim() || "미정";
  const right = end?.trim() || "미정";
  return `${left} ~ ${right}`;
}

function summarizeRequestChanges(summary: PartnerChangeRequestSummary) {
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
      label: "예약 링크",
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

function createRequestEntry(summary: PartnerChangeRequestSummary): PartnerNotificationEntry {
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

function createReviewEntry(review: {
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

function createOperationEntry(input: {
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
  const properties = input.properties ?? {};
  const summaryText = (() => {
    const summary = properties.summary;
    if (typeof summary === "string" && summary.trim()) {
      return summary.trim();
    }
    const changes = properties.changes;
    if (Array.isArray(changes)) {
      const text = changes
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(" · ");
      if (text) {
        return text;
      }
    }
    return null;
  })();

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

function sortEntries(entries: PartnerNotificationEntry[]) {
  return [...entries].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}

function buildSummary(
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

async function queryAuditLogs(params: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  targetType: string;
  actions: string[];
  targetIds?: string[];
  limit?: number;
}) {
  const query = params.targetIds && params.targetIds.length > 0
    ? params.supabase
        .from("admin_audit_logs")
        .select("id,action,target_type,target_id,properties,created_at")
        .eq("target_type", params.targetType)
        .in("action", params.actions)
        .in("target_id", params.targetIds)
        .order("created_at", { ascending: false })
        .limit(params.limit ?? 20)
    : params.supabase
        .from("admin_audit_logs")
        .select("id,action,target_type,target_id,properties,created_at")
        .eq("target_type", params.targetType)
        .in("action", params.actions)
        .order("created_at", { ascending: false })
        .limit(params.limit ?? 20);

  const { data, error } = await query;
  return {
    rows: (data ?? []) as PartnerAuditLogRow[],
    error: error ? error.message : null,
  };
}

async function loadSupabasePartnerNotificationCenter(
  companyIds: string[],
  accountId?: string | null,
): Promise<PartnerNotificationCenterData> {
  const supabase = getSupabaseAdminClient();
  let hasPartialFailure = false;
  const markPartialFailure = () => {
    hasPartialFailure = true;
  };

  const [companyResult, serviceResult, requestResult] = await Promise.all([
    supabase
      .from("partner_companies")
      .select("id,name,slug,description,is_active")
      .eq("is_active", true)
      .in("id", companyIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("partners")
      .select("id,company_id,name,location")
      .in("company_id", companyIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("partner_change_requests")
      .select(REQUEST_SELECT)
      .in("company_id", companyIds)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  if (companyResult.error) {
    markPartialFailure();
    console.error(
      "[partner-notifications] company query failed",
      companyResult.error.message,
    );
  }
  if (serviceResult.error) {
    markPartialFailure();
    console.error(
      "[partner-notifications] service query failed",
      serviceResult.error.message,
    );
  }
  if (requestResult.error) {
    markPartialFailure();
    console.error(
      "[partner-notifications] change request query failed",
      requestResult.error.message,
    );
  }

  const companies = (companyResult.error ? [] : companyResult.data ?? []) as PartnerCompanyRow[];
  const services = (serviceResult.error ? [] : serviceResult.data ?? []) as PartnerServiceRow[];
  const requests = (requestResult.error ? [] : requestResult.data ?? []) as PartnerChangeRequestRow[];
  const partnerIds = services.map((service) => service.id);

  const reviewResult =
    partnerIds.length > 0
      ? await supabase
          .from("partner_reviews")
          .select(
            "id,partner_id,rating,title,body,created_at,updated_at,deleted_at,hidden_at,partner:partners(id,name,company_id,company:partner_companies(id,name,slug)),member:members!partner_reviews_member_id_fkey(display_name,mm_username,year)",
          )
          .in("partner_id", partnerIds)
          .order("created_at", { ascending: false })
          .limit(20)
      : { data: [], error: null as null | { message: string } };

  if (reviewResult.error) {
    markPartialFailure();
    console.error(
      "[partner-notifications] review query failed",
      reviewResult.error.message,
    );
  }

  const reviews = (reviewResult.error ? [] : reviewResult.data ?? []) as PartnerReviewRow[];

  const companyMap = new Map(companies.map((company) => [company.id, company] as const));
  const partnerMap = new Map(services.map((service) => [service.id, service] as const));
  const reviewMap = new Map(
    reviews.map((review) => {
      const partner = getSingleRelation(review.partner);
      const company = getSingleRelation(partner?.company);
      const member = getSingleRelation(review.member);
      return [
        review.id,
        {
          id: review.id,
          partnerId: review.partner_id,
          partnerName: partner?.name ?? "미지정",
          companyId: partner?.company_id ?? null,
          companyName: company?.name ?? null,
          rating: review.rating,
          title: review.title,
          body: review.body,
          authorMaskedName: maskPartnerReviewAuthorName(member?.display_name),
          authorRoleLabel: getPartnerReviewAuthorRoleLabel(member?.year),
          createdAt: review.created_at,
        },
      ] as const;
    }),
  );

  const requestItems = requests.map((request) =>
    createRequestEntry(toPartnerChangeRequestSummary(request)),
  );

  const reviewItems = reviews.map((review) => {
    if (review.deleted_at || review.hidden_at) {
      return null;
    }
    const mapped = reviewMap.get(review.id);
    return mapped ? createReviewEntry(mapped) : null;
  }).filter((item): item is PartnerNotificationEntry => Boolean(item));

  const [companyAuditResult, partnerAuditResult, reviewAuditResult, accountAuditResult, accountCompanyAuditResult] =
    await Promise.all([
      queryAuditLogs({
        supabase,
        targetType: "partner_company",
        actions: ["partner_company_create", "partner_company_update", "partner_company_delete"],
        targetIds: companies.map((company) => company.id),
        limit: 20,
      }),
      queryAuditLogs({
        supabase,
        targetType: "partner",
        actions: ["partner_create", "partner_update", "partner_delete"],
        targetIds: partnerIds,
        limit: 20,
      }),
      queryAuditLogs({
        supabase,
        targetType: "partner_review",
        actions: [
          "partner_review_hide",
          "partner_review_restore",
          "partner_review_update",
          "partner_review_delete",
        ],
        targetIds: reviews.map((review) => review.id),
        limit: 20,
      }),
      accountId
        ? queryAuditLogs({
            supabase,
            targetType: "partner_account",
            actions: ["partner_account_create", "partner_account_update"],
            targetIds: [accountId],
            limit: 10,
          })
        : Promise.resolve({ rows: [] as PartnerAuditLogRow[], error: null as string | null }),
      queryAuditLogs({
        supabase,
        targetType: "partner_account_company",
        actions: ["partner_account_company_update"],
        limit: 20,
      }),
    ]);

  for (const result of [
    companyAuditResult,
    partnerAuditResult,
    reviewAuditResult,
    accountAuditResult,
    accountCompanyAuditResult,
  ]) {
    if (result.error) {
      markPartialFailure();
      console.error("[partner-notifications] audit query failed", result.error);
    }
  }

  const operationItems = [
    ...companyAuditResult.rows.map((row) => {
      const companyId = row.target_id ?? null;
      const company = companyId ? companyMap.get(companyId) ?? null : null;
      if (!company) {
        return null;
      }
      return createOperationEntry({
        id: row.id,
        action: row.action,
        properties: row.properties,
        createdAt: row.created_at,
        companyId,
        companyName: company.name,
        partnerId: null,
        partnerName: null,
      });
    }),
    ...partnerAuditResult.rows.map((row) => {
      const partnerId = row.target_id ?? null;
      const partner = partnerId ? partnerMap.get(partnerId) ?? null : null;
      if (!partner) {
        return null;
      }
      const company = partner.company_id ? companyMap.get(partner.company_id) ?? null : null;
      return createOperationEntry({
        id: row.id,
        action: row.action,
        properties: row.properties,
        createdAt: row.created_at,
        companyId: partner.company_id ?? null,
        companyName: company?.name ?? "미지정",
        partnerId,
        partnerName: partner.name,
      });
    }),
    ...reviewAuditResult.rows.map((row) => {
      const review = reviewMap.get(row.target_id ?? "");
      if (!review) {
        return null;
      }
      const partner = partnerMap.get(review.partnerId) ?? null;
      const company = review.companyId ? companyMap.get(review.companyId) ?? null : null;
      return createOperationEntry({
        id: row.id,
        action: row.action,
        properties: row.properties,
        createdAt: row.created_at,
        companyId: review.companyId,
        companyName: company?.name ?? review.companyName ?? "미지정",
        partnerId: review.partnerId,
        partnerName: partner?.name ?? review.partnerName,
        reviewTitle: review.title,
      });
    }),
    ...accountAuditResult.rows.map((row) => {
      const companyName = companies[0]?.name ?? "협력사 계정";
      return createOperationEntry({
        id: row.id,
        action: row.action,
        properties: row.properties,
        createdAt: row.created_at,
        companyId: null,
        companyName,
        partnerId: null,
        partnerName: null,
      });
    }),
    ...accountCompanyAuditResult.rows
      .filter((row) => {
        const properties = row.properties ?? {};
        const rowAccountId = typeof properties.accountId === "string" ? properties.accountId : null;
        const rowCompanyId = typeof properties.companyId === "string" ? properties.companyId : null;
        if (accountId && rowAccountId !== accountId) {
          return false;
        }
        if (!rowCompanyId) {
          return false;
        }
        return companyMap.has(rowCompanyId);
      })
      .map((row) => {
        const properties = row.properties ?? {};
        const rowCompanyId = typeof properties.companyId === "string" ? properties.companyId : null;
        const company = rowCompanyId ? companyMap.get(rowCompanyId) ?? null : null;
        return createOperationEntry({
          id: row.id,
          action: row.action,
          properties,
          createdAt: row.created_at,
          companyId: rowCompanyId,
          companyName: company?.name ?? "미지정",
          partnerId: null,
          partnerName: null,
        });
      }),
  ].filter((item): item is PartnerNotificationEntry => Boolean(item));

  const items = sortEntries([...requestItems, ...reviewItems, ...operationItems]);
  return {
    summary: buildSummary(items, companies.length, services.length),
    items,
    warningMessage: hasPartialFailure
      ? "일부 알림을 불러오지 못했습니다. 새로고침하면 최신 상태로 다시 시도합니다."
      : null,
  };
}

async function loadMockPartnerNotificationCenter(
  companyIds: string[],
  accountId?: string | null,
): Promise<PartnerNotificationCenterData> {
  const store = getMockPartnerChangeRequestStore();
  const uniqueCompanyIds = normalizeIds(companyIds);
  const companySetups = listMockPartnerPortalCompanySetups(uniqueCompanyIds);
  const companyMap = new Map(
    companySetups.map((setup) => [setup.company.id, setup.company] as const),
  );
  const services = store.services.filter((service) =>
    uniqueCompanyIds.includes(service.companyId),
  );
  const serviceMap = new Map(services.map((service) => [service.partnerId, service] as const));

  const requestItems = store.requests
    .filter((request) => uniqueCompanyIds.includes(request.companyId))
    .map((request) => createRequestEntry(request));

  const reviewItems = (
    await Promise.all(
      services.map(async (service) => {
        const result = await partnerReviewRepository.listPartnerReviews({
          partnerId: service.partnerId,
          sort: "latest",
          limit: 3,
          offset: 0,
          rating: "all",
          imagesOnly: false,
          includeHidden: false,
        });
        return result.items
          .filter((review) => !review.isHidden)
          .map((review) =>
            createReviewEntry({
              id: review.id,
              partnerId: review.partnerId,
              partnerName: service.partnerName,
              companyId: service.companyId,
              companyName: service.companyName,
              rating: review.rating,
              title: review.title,
              body: review.body,
              authorMaskedName: review.authorMaskedName,
              authorRoleLabel: review.authorRoleLabel,
              createdAt: review.createdAt,
            }),
          );
      }),
    )
  ).flat();

  const operationItems: PartnerNotificationEntry[] = [];
  if (accountId) {
    operationItems.push({
      id: `mock-account:${accountId}`,
      category: "operation",
      status: "updated",
      tone: "primary",
      badgeLabel: "계정",
      title: "협력사 계정 정보가 수정되었습니다",
      body: "Mock 환경에서는 계정 관련 운영 알림이 제한적으로 표시됩니다.",
      companyId: null,
      companyName: "협력사 계정",
      partnerId: null,
      partnerName: null,
      href: "/partner",
      createdAt: new Date().toISOString(),
    });
  }

  const items = sortEntries([...requestItems, ...reviewItems, ...operationItems]);
  return {
    summary: buildSummary(items, companyMap.size, serviceMap.size),
    items,
    warningMessage: null,
  };
}

export async function getPartnerNotificationCenter(
  companyIds: string[],
  accountId?: string | null,
): Promise<PartnerNotificationCenterData> {
  const uniqueCompanyIds = normalizeIds(companyIds);
  if (uniqueCompanyIds.length === 0) {
    return {
      summary: {
        totalCount: 0,
        requestCount: 0,
        pendingRequestCount: 0,
        resolvedRequestCount: 0,
        reviewCount: 0,
        operationCount: 0,
        companyCount: 0,
        serviceCount: 0,
      },
      items: [],
      warningMessage: null,
    };
  }

  if (isPartnerPortalMock) {
    return loadMockPartnerNotificationCenter(uniqueCompanyIds, accountId);
  }

  return loadSupabasePartnerNotificationCenter(uniqueCompanyIds, accountId);
}
