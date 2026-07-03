import { normalizeNotificationTargetUrl } from "@/lib/notifications/shared";

export type AdminNotificationRelation = {
  id?: string | null;
  type?: string | null;
  title?: string | null;
  body?: string | null;
  target_url?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type AdminNotificationRecipientRow = {
  id?: string | null;
  read_at?: string | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  notification?: AdminNotificationRelation | AdminNotificationRelation[] | null;
};

export type AdminNotificationInboxItem = {
  id: string;
  adminNotificationRecipientId: string;
  notificationId: string;
  type: string;
  title: string;
  body: string;
  targetUrl: string;
  metadata: Record<string, unknown>;
  readAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isUnread: boolean;
};

export type AdminNotificationListResult = {
  unreadCount: number;
  items: AdminNotificationInboxItem[];
  nextOffset: number;
  hasMore: boolean;
};

type BuildAdminNotificationListResultInput = {
  unreadCount: number;
  rows: AdminNotificationRecipientRow[];
  offset: number;
  limit: number;
  hasMore?: boolean;
};

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 20;
const MAX_OFFSET = 1000;

function parseBoundedInteger(
  value: string | number | null | undefined,
  fallback: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(max, Math.trunc(parsed)));
}

function normalizeNotificationRelation(
  value: AdminNotificationRecipientRow["notification"],
) {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapAdminNotificationRow(
  row: AdminNotificationRecipientRow,
): AdminNotificationInboxItem | null {
  const notification = normalizeNotificationRelation(row.notification);
  if (!row.id || !notification?.id) {
    return null;
  }

  const createdAt =
    notification.created_at ??
    row.created_at ??
    row.updated_at ??
    new Date(0).toISOString();
  const updatedAt = row.updated_at ?? row.created_at ?? createdAt;

  return {
    id: notification.id,
    adminNotificationRecipientId: row.id,
    notificationId: notification.id,
    type: notification.type ?? "notification",
    title: notification.title ?? "관리자 알림",
    body: notification.body ?? "",
    targetUrl: normalizeNotificationTargetUrl(notification.target_url) ?? "/admin",
    metadata: notification.metadata ?? {},
    readAt: row.read_at ?? null,
    deletedAt: row.deleted_at ?? null,
    createdAt,
    updatedAt,
    isUnread: row.read_at == null,
  };
}

export function parseAdminNotificationPaging(input: {
  offset?: string | number | null;
  limit?: string | number | null;
}) {
  return {
    offset: parseBoundedInteger(input.offset, 0, MAX_OFFSET),
    limit: Math.max(
      1,
      parseBoundedInteger(input.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    ),
  };
}

export function buildAdminNotificationListResult({
  unreadCount,
  rows,
  offset,
  limit,
  hasMore,
}: BuildAdminNotificationListResultInput): AdminNotificationListResult {
  const visibleRows = hasMore === undefined ? rows.slice(0, limit) : rows;
  const items = visibleRows
    .map(mapAdminNotificationRow)
    .filter((item): item is AdminNotificationInboxItem => item !== null);

  return {
    unreadCount: Math.max(0, unreadCount),
    items,
    nextOffset: offset + items.length,
    hasMore: hasMore ?? rows.length > limit,
  };
}

export function getAdminNotificationTypeLabel(type: string) {
  switch (type) {
    case "partner_change_request":
      return "변경 요청";
    case "partner_immediate_update":
      return "즉시 수정";
    case "expiring_partner":
      return "종료 임박";
    case "security_alert":
      return "보안";
    default:
      return "알림";
  }
}
