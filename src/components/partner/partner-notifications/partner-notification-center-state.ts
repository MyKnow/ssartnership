import type {
  PartnerNotificationCenterData,
  PartnerNotificationEntry,
  PartnerStoredNotificationPage,
} from "@/lib/partner-notification-contract";

export type PartnerNotificationCenterState = {
  items: PartnerNotificationEntry[];
  pendingNotificationId: string | null;
  pendingBulkAction: "read-visible" | "read-all-stored" | "delete-action" | null;
  storedPage: PartnerStoredNotificationPage;
  loadingMore: boolean;
};

export function createPartnerNotificationCenterState(
  data: PartnerNotificationCenterData,
): PartnerNotificationCenterState {
  return {
    items: data.items,
    pendingNotificationId: null,
    pendingBulkAction: null,
    storedPage: data.storedPage ?? { nextOffset: 0, hasMore: false, unreadCount: null },
    loadingMore: false,
  };
}

export function updateNotificationReadState(
  items: PartnerNotificationEntry[],
  notificationIds: string[],
  readAt: string,
) {
  const targets = new Set(notificationIds);
  return items.map((item) =>
    item.notificationId && targets.has(item.notificationId)
      ? {
          ...item,
          readAt,
          isUnread: false,
          tone: item.tone === "primary" ? "neutral" : item.tone,
          badgeLabel: item.badgeLabel.includes("새") ? "확인됨" : item.badgeLabel,
        }
      : item,
  );
}

export function markAllStoredNotificationsRead(
  items: PartnerNotificationEntry[],
  readAt: string,
) {
  return updateNotificationReadState(
    items,
    items
      .filter((item) => item.notificationId && item.isUnread)
      .map((item) => item.notificationId as string),
    readAt,
  );
}

export function removeNotifications(
  items: PartnerNotificationEntry[],
  notificationIds: string[],
) {
  const targets = new Set(notificationIds);
  return items.filter((item) => !item.notificationId || !targets.has(item.notificationId));
}
