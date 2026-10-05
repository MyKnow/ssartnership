export type PartnerNotificationCategory = "request" | "review" | "operation" | "plan";

/** 파트너 저장 알림 한 번에 불러오는 건수(서버 GET 상한과 같다). */
export const PARTNER_NOTIFICATION_PAGE_SIZE = 20;
/** 비정상적으로 큰 offset으로 깊은 페이지를 긁는 요청을 막는 상한 */
export const MAX_PARTNER_NOTIFICATION_OFFSET = 10_000;

export const PARTNER_NOTIFICATION_CENTER_SCOPE_LABEL =
  `요약과 필터 결과는 현재 화면에 불러온 알림 기준입니다. 저장 알림은 ${PARTNER_NOTIFICATION_PAGE_SIZE}건씩 더 불러올 수 있고, 변경 요청·리뷰·운영 로그는 최근 20건(계정 로그 10건)만 합산합니다.`;

export const PARTNER_NOTIFICATION_PARTIAL_FILTER_NOTICE =
  "필터 결과는 지금까지 불러온 알림 기준입니다. 이전 알림을 더 불러오면 결과가 늘어날 수 있습니다.";

export type PartnerNotificationPageQuery = {
  offset: number;
  limit: number;
};

function parseNonNegativeInteger(value: string | null | undefined) {
  if (value == null || value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
}

/** GET /api/partner/notifications 쿼리 해석(서버)과 생성(클라이언트)이 같은 규칙을 쓴다. */
export function parsePartnerNotificationPageQuery(
  searchParams: Pick<URLSearchParams, "get">,
): PartnerNotificationPageQuery {
  const offset = Math.min(
    MAX_PARTNER_NOTIFICATION_OFFSET,
    parseNonNegativeInteger(searchParams.get("offset")) ?? 0,
  );
  const limit = Math.min(
    PARTNER_NOTIFICATION_PAGE_SIZE,
    Math.max(
      1,
      parseNonNegativeInteger(searchParams.get("limit")) ??
        PARTNER_NOTIFICATION_PAGE_SIZE,
    ),
  );
  return { offset, limit };
}

export function buildPartnerNotificationPageQuery(input: {
  offset: number;
  limit?: number;
}) {
  const normalized = parsePartnerNotificationPageQuery(
    new URLSearchParams({
      offset: String(input.offset),
      limit: String(input.limit ?? PARTNER_NOTIFICATION_PAGE_SIZE),
    }),
  );
  return new URLSearchParams({
    offset: String(normalized.offset),
    limit: String(normalized.limit),
  }).toString();
}

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

/**
 * 저장 알림(파트너 계정 수신함) 페이지 상태. 변경 요청·리뷰·운영 로그는
 * 최근 N건만 합산하므로 페이지네이션은 저장 알림에만 적용한다.
 */
export type PartnerStoredNotificationPage = {
  nextOffset: number;
  hasMore: boolean;
  /** 계정의 저장 알림 전체 미확인 수(불러온 페이지와 무관). 조회 실패 시 null */
  unreadCount: number | null;
};

export type PartnerNotificationCenterData = {
  summary: PartnerNotificationCenterSummary;
  items: PartnerNotificationEntry[];
  warningMessage: string | null;
  /** 생략되면 추가로 불러올 저장 알림이 없는 것으로 본다. */
  storedPage?: PartnerStoredNotificationPage;
};

/** GET /api/partner/notifications 응답(회원 /api/notifications 봉투와 같은 모양) */
export type PartnerNotificationListResponse = {
  ok: true;
  summary: { unreadCount: number };
  unreadCount: number;
  items: PartnerNotificationEntry[];
  nextOffset: number;
  hasMore: boolean;
};
