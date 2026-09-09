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
