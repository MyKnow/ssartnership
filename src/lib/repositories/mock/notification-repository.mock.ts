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
  FinalizeNotificationCampaignInput,
  NotificationCampaignClaimInput,
  NotificationCampaignClaimResult,
  NotificationDeliveryClaimInput,
  NotificationDeliveryClaimResult,
  NotificationListContext,
  NotificationRecipientAudience,
  NotificationRepository,
  TransitionNotificationDeliveryInput,
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
  provider: string | null;
  providerNotificationId: string | null;
  providerCampaignId: string | null;
  providerIdempotencyKey: string | null;
  providerStatus: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
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

function createMockNotificationId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `mock-notification-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ensureMockNotificationRecipients(
  notificationId: string,
  recipientMemberIds: string[],
  now: string,
) {
  const store = getStore();
  for (const memberId of Array.from(new Set(recipientMemberIds))) {
    if (
      !store.memberNotifications.some(
        (item) =>
          item.notificationId === notificationId && item.memberId === memberId,
      )
    ) {
      store.memberNotifications.unshift({
        id: createMockNotificationId(),
        notificationId,
        memberId,
        readAt: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (
      !store.deliveries.some(
        (item) =>
          item.notificationId === notificationId &&
          item.memberId === memberId &&
          item.channel === "in_app",
      )
    ) {
      store.deliveries.unshift({
        id: createMockNotificationId(),
        notificationId,
        memberId,
        channel: "in_app",
        status: "sent",
        errorMessage: null,
        provider: null,
        providerNotificationId: null,
        providerCampaignId: null,
        providerIdempotencyKey: null,
        providerStatus: null,
        deliveredAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
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
      id: createMockNotificationId(),
      type: input.type,
      title: input.title,
      body: input.body,
      targetUrl,
      metadata: input.metadata ?? {},
      createdByMemberId: input.createdByMemberId ?? null,
      createdAt: now,
    };
    const store = getStore();
    const idempotencyKey = input.idempotencyKey?.trim() || null;
    if (idempotencyKey) {
      const existing = store.notifications.find(
        (item) => item.metadata?.adminOperationIdempotencyKey === idempotencyKey,
      );
      if (existing) {
        return {
          notification: existing,
          recipientMemberIds: [],
          alreadyExists: true,
        };
      }
      notification.metadata = {
        ...notification.metadata,
        adminOperationIdempotencyKey: idempotencyKey,
      };
    }
    store.notifications.unshift(notification);

    const recipientMemberIds = Array.from(
      new Set((input.recipientMemberIds ?? []).filter((value) => value.trim().length > 0)),
    );

    ensureMockNotificationRecipients(notification.id, recipientMemberIds, now);

    return {
      notification,
      recipientMemberIds,
    };
  }

  async addNotificationRecipients(
    notificationId: string,
    recipientMemberIds: string[],
  ) {
    const notification = getStore().notifications.find(
      (item) => item.id === notificationId,
    );
    if (!notification) {
      throw new Error("알림을 찾을 수 없습니다.");
    }
    ensureMockNotificationRecipients(
      notificationId,
      recipientMemberIds,
      new Date().toISOString(),
    );
  }

  async addNotificationAudienceRecipients(
    notificationId: string,
    audience: NotificationRecipientAudience,
  ) {
    const recipientMemberIds = audience.memberIds ?? [];
    await this.addNotificationRecipients(notificationId, recipientMemberIds);
    return new Set(recipientMemberIds).size;
  }

  async claimNotificationCampaign(
    input: NotificationCampaignClaimInput,
  ): Promise<NotificationCampaignClaimResult> {
    const targetUrl = normalizeNotificationTargetUrl(input.targetUrl);
    if (
      !targetUrl ||
      !input.type.trim() ||
      !input.title.trim() ||
      !input.body.trim() ||
      !input.idempotencyKey.trim() ||
      input.leaseDurationSeconds < 30 ||
      input.leaseDurationSeconds > 3600
    ) {
      throw new Error("알림 발송 요청이 올바르지 않습니다.");
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const store = getStore();
    let notification = store.notifications.find(
      (item) =>
        item.metadata?.adminOperationIdempotencyKey ===
        input.idempotencyKey.trim(),
    );

    if (notification) {
      if (notification.type !== input.type) {
        throw new Error("알림 캠페인 재시도 키가 다른 유형과 충돌했습니다.");
      }
      const status = notification.metadata?.campaignStatus;
      if (status === "sent" || status === "no_target") {
        return {
          notification,
          recipientMemberIds: [],
          disposition: "completed",
          attemptToken: null,
        };
      }

      const leaseExpiresAt =
        typeof notification.metadata?.campaignLeaseExpiresAt === "string"
          ? Date.parse(notification.metadata.campaignLeaseExpiresAt)
          : Number.NaN;
      if (status === "pending" && leaseExpiresAt > now.getTime()) {
        return {
          notification,
          recipientMemberIds: [],
          disposition: "in_progress",
          attemptToken: null,
        };
      }
    }

    const attemptToken = createMockNotificationId();
    const previousMetadata = Object.fromEntries(
      Object.entries(notification?.metadata ?? {}).filter(
        ([key]) =>
          key !== "completedAt" &&
          key !== "channelResults" &&
          key !== "warnings",
      ),
    );
    const inputMetadata = Object.fromEntries(
      Object.entries(input.metadata ?? {}).filter(
        ([key]) =>
          key !== "completedAt" &&
          key !== "channelResults" &&
          key !== "warnings",
      ),
    );
    const claimedMetadata = {
      ...previousMetadata,
      ...inputMetadata,
      adminOperationIdempotencyKey: input.idempotencyKey.trim(),
      campaignStatus: "pending",
      campaignAttemptToken: attemptToken,
      campaignClaimedAt: nowIso,
      campaignLeaseExpiresAt: new Date(
        now.getTime() + input.leaseDurationSeconds * 1000,
      ).toISOString(),
    };
    const disposition = notification ? "resumed" : "claimed";

    if (!notification) {
      notification = {
        id: createMockNotificationId(),
        type: input.type,
        title: input.title,
        body: input.body,
        targetUrl,
        metadata: claimedMetadata,
        createdByMemberId: input.createdByMemberId ?? null,
        createdAt: nowIso,
      };
      store.notifications.unshift(notification);
    } else {
      notification.title = input.title;
      notification.body = input.body;
      notification.targetUrl = targetUrl;
      notification.metadata = claimedMetadata;
    }

    const recipientMemberIds = Array.from(
      new Set(input.recipientMemberIds.filter((value) => value.trim().length > 0)),
    );
    ensureMockNotificationRecipients(
      notification.id,
      recipientMemberIds,
      nowIso,
    );

    return {
      notification,
      recipientMemberIds,
      disposition,
      attemptToken,
    };
  }

  async finalizeNotificationCampaign(
    input: FinalizeNotificationCampaignInput,
  ) {
    const notification = getStore().notifications.find(
      (item) => item.id === input.notificationId,
    );
    if (
      !notification ||
      notification.metadata?.campaignStatus !== "pending" ||
      notification.metadata?.campaignAttemptToken !== input.attemptToken
    ) {
      return false;
    }

    const status = input.metadata.campaignStatus;
    if (
      status !== "sent" &&
      status !== "partial_failed" &&
      status !== "failed" &&
      status !== "no_target"
    ) {
      throw new Error("알림 캠페인 완료 상태가 올바르지 않습니다.");
    }

    notification.metadata = {
      ...notification.metadata,
      ...input.metadata,
      campaignAttemptToken: input.attemptToken,
      campaignLeaseExpiresAt: null,
    };
    return true;
  }

  async claimNotificationDelivery(
    input: NotificationDeliveryClaimInput,
  ): Promise<NotificationDeliveryClaimResult> {
    if (
      input.channel !== "push" ||
      input.provider !== "web_push" ||
      !input.memberId ||
      !input.providerIdempotencyKey.trim() ||
      input.leaseDurationSeconds < 30 ||
      input.leaseDurationSeconds > 3600
    ) {
      throw new Error("알림 전송 요청이 올바르지 않습니다.");
    }
    const store = getStore();
    const now = new Date();
    const nowIso = now.toISOString();
    const existing = store.deliveries.find(
      (item) =>
        item.provider === input.provider &&
        item.providerIdempotencyKey === input.providerIdempotencyKey,
    );

    if (!existing) {
      const deliveryId = createMockNotificationId();
      store.deliveries.unshift({
        id: deliveryId,
        notificationId: input.notificationId,
        memberId: input.memberId,
        channel: input.channel,
        status: "pending",
        errorMessage: null,
        provider: input.provider ?? null,
        providerNotificationId: null,
        providerCampaignId: input.providerCampaignId ?? null,
        providerIdempotencyKey: input.providerIdempotencyKey,
        providerStatus: "claimed",
        deliveredAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      return { deliveryId, disposition: "claimed" };
    }

    if (
      existing.notificationId !== input.notificationId ||
      existing.memberId !== input.memberId ||
      existing.channel !== input.channel ||
      existing.providerCampaignId !== (input.providerCampaignId ?? null)
    ) {
      throw new Error("알림 전송 재시도 키가 다른 대상과 충돌했습니다.");
    }
    if (existing.status === "sent") {
      return { deliveryId: existing.id, disposition: "sent" };
    }
    if (existing.providerStatus === "needs_reconciliation") {
      return {
        deliveryId: existing.id,
        disposition: "needs_reconciliation",
      };
    }
    if (existing.status === "failed") {
      existing.status = "pending";
      existing.providerStatus = "claimed";
      existing.errorMessage = null;
      existing.deliveredAt = null;
      existing.updatedAt = nowIso;
      return { deliveryId: existing.id, disposition: "claimed" };
    }

    const leaseExpired =
      Date.parse(existing.updatedAt) <=
      now.getTime() - input.leaseDurationSeconds * 1000;
    if (leaseExpired && existing.providerStatus === "claimed") {
      existing.updatedAt = nowIso;
      return { deliveryId: existing.id, disposition: "claimed" };
    }
    if (leaseExpired && existing.providerStatus === "sending") {
      existing.providerStatus = "needs_reconciliation";
      existing.errorMessage = "provider_delivery_outcome_unknown";
      existing.updatedAt = nowIso;
      return {
        deliveryId: existing.id,
        disposition: "needs_reconciliation",
      };
    }
    return { deliveryId: existing.id, disposition: "in_progress" };
  }

  async transitionNotificationDelivery(
    input: TransitionNotificationDeliveryInput,
  ) {
    const delivery = getStore().deliveries.find(
      (item) => item.id === input.deliveryId,
    );
    if (
      !delivery ||
      delivery.channel !== "push" ||
      delivery.provider !== "web_push" ||
      delivery.status !== "pending"
    ) {
      return false;
    }

    const now = new Date().toISOString();
    if (input.transition === "sending") {
      if (delivery.providerStatus !== "claimed") return false;
      delivery.providerStatus = "sending";
    } else if (input.transition === "sent") {
      if (delivery.providerStatus !== "sending") return false;
      delivery.status = "sent";
      delivery.providerStatus = "sent";
      delivery.errorMessage = null;
      delivery.deliveredAt = now;
    } else if (input.transition === "failed") {
      if (delivery.providerStatus !== "sending") return false;
      delivery.status = "failed";
      delivery.providerStatus = "failed";
      delivery.errorMessage = input.errorMessage ?? "푸시 알림 전송에 실패했습니다.";
      delivery.deliveredAt = null;
    } else {
      if (
        delivery.providerStatus !== "sending" &&
        delivery.providerStatus !== "claimed"
      ) {
        return false;
      }
      delivery.providerStatus = "needs_reconciliation";
      delivery.errorMessage =
        input.errorMessage ?? "provider_delivery_outcome_unknown";
      delivery.deliveredAt = null;
    }
    delivery.updatedAt = now;
    return true;
  }

  async recordNotificationDelivery(input: NotificationDeliveryInput) {
    const now = input.deliveredAt ?? new Date().toISOString();
    getStore().deliveries.unshift({
      id: createMockNotificationId(),
      notificationId: input.notificationId,
      memberId: input.memberId,
      channel: input.channel,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      provider: input.provider ?? null,
      providerNotificationId: input.providerNotificationId ?? null,
      providerCampaignId: input.providerCampaignId ?? null,
      providerIdempotencyKey: input.providerIdempotencyKey ?? null,
      providerStatus: input.providerStatus ?? null,
      deliveredAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateNotificationMetadata(
    notificationId: string,
    metadata: Record<string, unknown>,
  ) {
    const notification = getStore().notifications.find((item) => item.id === notificationId);
    if (!notification) {
      throw new Error("알림을 찾을 수 없습니다.");
    }
    notification.metadata = metadata;
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

  async markAllMemberNotificationsRead(memberId: string) {
    const now = new Date().toISOString();
    let count = 0;
    for (const record of getStore().memberNotifications) {
      if (record.memberId !== memberId || record.deletedAt !== null || record.readAt !== null) {
        continue;
      }
      record.readAt = now;
      record.updatedAt = now;
      count += 1;
    }
    return count;
  }

  async softDeleteAllMemberNotifications(memberId: string) {
    const now = new Date().toISOString();
    let count = 0;
    for (const record of getStore().memberNotifications) {
      if (record.memberId !== memberId || record.deletedAt !== null) {
        continue;
      }
      record.deletedAt = now;
      record.updatedAt = now;
      count += 1;
    }
    return count;
  }
}
