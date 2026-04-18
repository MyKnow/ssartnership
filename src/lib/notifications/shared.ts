export const NOTIFICATION_CHANNELS = ["in_app", "push", "mm"] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_DELIVERY_STATUSES = [
  "pending",
  "sent",
  "failed",
  "skipped",
] as const;

export type NotificationDeliveryStatus =
  (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export type NotificationRecord = {
  id: string;
  type: string;
  title: string;
  body: string;
  targetUrl: string;
  metadata: Record<string, unknown>;
  createdByMemberId: string | null;
  createdAt: string;
};

export type MemberNotificationRecord = NotificationRecord & {
  memberNotificationId: string;
  memberId: string;
  readAt: string | null;
  deletedAt: string | null;
  updatedAt: string;
  isUnread: boolean;
};

export type NotificationListResult = {
  unreadCount: number;
  items: MemberNotificationRecord[];
  nextOffset: number;
  hasMore: boolean;
};

export type NotificationBroadcastInput = {
  type: string;
  title: string;
  body: string;
  targetUrl: string;
  metadata?: Record<string, unknown>;
  createdByMemberId?: string | null;
  recipientMemberIds: string[];
};

export type NotificationDeliveryInput = {
  notificationId: string;
  memberId: string | null;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  errorMessage?: string | null;
  deliveredAt?: string | null;
};

export function normalizeNotificationTargetUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  return null;
}

export function getNotificationTypeLabel(type: string) {
  switch (type) {
    case "announcement":
      return "운영 공지";
    case "new_partner":
      return "신규 제휴";
    case "expiring_partner":
      return "종료 임박";
    case "marketing":
      return "마케팅";
    case "system":
      return "시스템";
    default:
      return "알림";
  }
}

export function getNotificationChannelLabel(channel: NotificationChannel) {
  switch (channel) {
    case "in_app":
      return "앱";
    case "push":
      return "푸시";
    case "mm":
      return "MM";
  }
}
