import { isPartnerPortalMock } from "@/lib/partner-portal";
import { partnerReviewRepository } from "@/lib/repositories";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  REQUEST_SELECT,
  type PartnerChangeRequestRow,
} from "@/lib/partner-change-requests/shared";
import { toSummary as toPartnerChangeRequestSummary } from "@/lib/partner-change-requests/summary";
import { getStore as getMockPartnerChangeRequestStore } from "@/lib/mock/partner-change-requests/service-store";
import { listMockPartnerPortalCompanySetups } from "@/lib/mock/partner-portal/store";
import {
  getPartnerReviewAuthorRoleLabel,
  maskPartnerReviewAuthorName,
} from "@/lib/partner-reviews";
import { createRequestEntry } from "@/lib/partner-notifications-request";
import {
  buildSummary,
  createOperationEntry,
  createReviewEntry,
  sortEntries,
} from "@/lib/partner-notifications-operation";
import { getPartnerScopedHrefFromLegacyTarget } from "@/lib/partner-portal-paths";

export type PartnerNotificationCategory = "request" | "review" | "operation" | "plan";

export const PARTNER_NOTIFICATION_CENTER_SCOPE_LABEL =
  "요약과 필터 결과는 현재 화면에 불러온 최근 알림 기준입니다. 운영 데이터는 저장 알림 최근 30건, 변경 요청/리뷰/운영 로그 최근 20건(계정 로그 10건)을 합산합니다.";

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
  | "granted"
  | "notified";

export type PartnerNotificationEntry = {
  id: string;
  notificationId?: string | null;
  readAt?: string | null;
  isUnread?: boolean;
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

type PartnerReviewMemberRow = {
  display_name: string | null;
  generation: number | null;
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
  member?: PartnerReviewMemberRow | PartnerReviewMemberRow[] | null;
};

type PartnerAuditLogRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
};

type StoredPartnerNotificationRow = {
  id: string;
  read_at: string | null;
  created_at: string;
  notification?:
    | {
        id: string;
        type: string;
        title: string;
        body: string;
        target_url: string;
        company_id: string | null;
        created_at: string;
      }
    | {
        id: string;
        type: string;
        title: string;
        body: string;
        target_url: string;
        company_id: string | null;
        created_at: string;
      }[]
    | null;
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

function createStoredNotificationEntry(
  row: StoredPartnerNotificationRow,
  companyMap: Map<string, PartnerCompanyRow>,
): PartnerNotificationEntry | null {
  const notification = getSingleRelation(row.notification);
  if (!notification) {
    return null;
  }
  if (notification.company_id && !companyMap.has(notification.company_id)) {
    return null;
  }
  const company = notification.company_id ? companyMap.get(notification.company_id) ?? null : null;
  return {
    id: `stored:${notification.id}`,
    notificationId: notification.id,
    readAt: row.read_at,
    isUnread: row.read_at == null,
    category: "plan",
    status: "notified",
    tone: row.read_at ? "neutral" : "primary",
    badgeLabel: row.read_at ? "확인됨" : "새 알림",
    title: notification.title,
    body: notification.body,
    companyId: notification.company_id,
    companyName: company?.name ?? "파트너사",
    partnerId: null,
    partnerName: null,
    href: getPartnerScopedHrefFromLegacyTarget(
      notification.target_url,
      notification.company_id,
    ),
    createdAt: notification.created_at,
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
            "id,partner_id,rating,title,body,created_at,updated_at,deleted_at,hidden_at,partner:partners(id,name,company_id,company:partner_companies(id,name,slug)),member:members!partner_reviews_member_id_fkey(display_name,generation)",
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
          authorRoleLabel: getPartnerReviewAuthorRoleLabel(member?.generation),
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
      const companyName = companies[0]?.name ?? "파트너사 계정";
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

  const storedNotificationResult = accountId
    ? await supabase
        .from("partner_notification_recipients")
        .select(
          "id,read_at,created_at,notification:partner_notifications(id,type,title,body,target_url,company_id,created_at)",
        )
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [], error: null as null | { message: string } };

  if (storedNotificationResult.error) {
    markPartialFailure();
    console.error(
      "[partner-notifications] stored notification query failed",
      storedNotificationResult.error.message,
    );
  }

  const storedItems = ((storedNotificationResult.data ?? []) as StoredPartnerNotificationRow[])
    .map((row) => createStoredNotificationEntry(row, companyMap))
    .filter((item): item is PartnerNotificationEntry => Boolean(item));

  const items = sortEntries([...storedItems, ...requestItems, ...reviewItems, ...operationItems]);
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
      title: "파트너사 계정 정보가 수정되었습니다",
      body: "Mock 환경에서는 계정 관련 운영 알림이 제한적으로 표시됩니다.",
      companyId: null,
      companyName: "파트너사 계정",
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
