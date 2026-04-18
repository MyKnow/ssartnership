import { randomUUID } from "node:crypto";
import {
  normalizeNotificationTargetUrl,
  type MemberNotificationRecord,
  type NotificationBroadcastInput,
  type NotificationDeliveryInput,
  type NotificationListResult,
  type NotificationRecord,
} from "../../notifications/shared.ts";
import type {
  CreateNotificationResult,
  NotificationListContext,
  NotificationRepository,
} from "../notification-repository.ts";

type MockNotification = NotificationRecord;

type MockMemberNotification = {
  id: string;
  notificationId: string;
  memberId: string;
  readAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type MockNotificationDelivery = {
  id: string;
  notificationId: string;
  memberId: string | null;
  channel: NotificationDeliveryInput["channel"];
  status: NotificationDeliveryInput["status"];
  errorMessage: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

type MockNotificationStore = {
  notifications: MockNotification[];
  memberNotifications: MockMemberNotification[];
  deliveries: MockNotificationDelivery[];
};

const globalScope = globalThis as typeof globalThis & {
  __mockNotificationStore?: MockNotificationStore;
};

function getStore() {
  if (!globalScope.__mockNotificationStore) {
    globalScope.__mockNotificationStore = {
      notifications: [],
      memberNotifications: [],
      deliveries: [],
    };
  }
  return globalScope.__mockNotificationStore;
}

function mapRecord(record: MockMemberNotification): MemberNotificationRecord {
  const notification = getStore().notifications.find(
    (item) => item.id === record.notificationId,
  );
  if (!notification) {
    throw new Error("알림을 찾을 수 없습니다.");
  }

  return {
    ...notification,
    memberNotificationId: record.id,
    memberId: record.memberId,
    readAt: record.readAt,
    deletedAt: record.deletedAt,
    updatedAt: record.updatedAt,
    isUnread: record.readAt === null && record.deletedAt === null,
  };
}

function sortNotifications(records: MockMemberNotification[]) {
  return [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export class MockNotificationRepository implements NotificationRepository {
  async createNotification(
    input: NotificationBroadcastInput,
  ): Promise<CreateNotificationResult> {
    const targetUrl = normalizeNotificationTargetUrl(input.targetUrl);
    if (!targetUrl) {
      throw new Error("알림 이동 URL은 내부 경로여야 합니다.");
    }

    const now = new Date().toISOString();
    const notification: MockNotification = {
      id: randomUUID(),
      type: input.type,
      title: input.title,
      body: input.body,
      targetUrl,
      metadata: input.metadata ?? {},
      createdByMemberId: input.createdByMemberId ?? null,
      createdAt: now,
    };
    const store = getStore();
    store.notifications.unshift(notification);

    const recipientMemberIds = Array.from(
      new Set((input.recipientMemberIds ?? []).filter((value) => value.trim().length > 0)),
    );

    for (const memberId of recipientMemberIds) {
      store.memberNotifications.unshift({
        id: randomUUID(),
        notificationId: notification.id,
        memberId,
        readAt: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      store.deliveries.unshift({
        id: randomUUID(),
        notificationId: notification.id,
        memberId,
        channel: "in_app",
        status: "sent",
        errorMessage: null,
        deliveredAt: now,
        createdAt: now,
      });
    }

    return {
      notification,
      recipientMemberIds,
    };
  }

  async recordNotificationDelivery(input: NotificationDeliveryInput) {
    const now = input.deliveredAt ?? new Date().toISOString();
    getStore().deliveries.unshift({
      id: randomUUID(),
      notificationId: input.notificationId,
      memberId: input.memberId,
      channel: input.channel,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      deliveredAt: now,
      createdAt: now,
    });
  }

  async getUnreadNotificationCount(memberId: string) {
    return getStore().memberNotifications.filter(
      (item) => item.memberId === memberId && item.deletedAt === null && item.readAt === null,
    ).length;
  }

  async listMemberNotifications(
    context: NotificationListContext,
  ): Promise<NotificationListResult> {
    const limit = Math.max(1, Math.min(20, context.limit ?? 10));
    const offset = Math.max(0, context.offset ?? 0);
    const filtered = sortNotifications(
      getStore().memberNotifications.filter(
        (item) => item.memberId === context.memberId && item.deletedAt === null,
      ),
    );
    const unreadCount = filtered.filter((item) => item.readAt === null).length;
    const page = filtered.slice(offset, offset + limit);

    return {
      unreadCount,
      items: page.map(mapRecord),
      nextOffset: offset + page.length,
      hasMore: offset + page.length < filtered.length,
    };
  }

  async getMemberNotification(memberId: string, notificationId: string) {
    const record = getStore().memberNotifications.find(
      (item) => item.memberId === memberId && item.notificationId === notificationId,
    );
    return record ? mapRecord(record) : null;
  }

  async markMemberNotificationRead(memberId: string, notificationId: string) {
    const record = getStore().memberNotifications.find(
      (item) =>
        item.memberId === memberId &&
        item.notificationId === notificationId &&
        item.deletedAt === null,
    );
    if (!record) {
      return false;
    }
    record.readAt = new Date().toISOString();
    record.updatedAt = record.readAt;
    return true;
  }

  async softDeleteMemberNotification(memberId: string, notificationId: string) {
    const record = getStore().memberNotifications.find(
      (item) =>
        item.memberId === memberId &&
        item.notificationId === notificationId &&
        item.deletedAt === null,
    );
    if (!record) {
      return false;
    }
    record.deletedAt = new Date().toISOString();
    record.updatedAt = record.deletedAt;
    return true;
  }
}
