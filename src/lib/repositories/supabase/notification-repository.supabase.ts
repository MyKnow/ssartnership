import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  normalizeNotificationTargetUrl,
  type MemberNotificationRecord,
  type NotificationBroadcastInput,
  type NotificationDeliveryInput,
  type NotificationListResult,
  type NotificationRecord,
} from "@/lib/notifications/shared";
import type {
  CreateNotificationResult,
  FinalizeNotificationCampaignInput,
  NotificationCampaignClaimDisposition,
  NotificationCampaignClaimInput,
  NotificationCampaignClaimResult,
  NotificationDeliveryClaimDisposition,
  NotificationDeliveryClaimInput,
  NotificationDeliveryClaimResult,
  NotificationListContext,
  NotificationRecipientAudience,
  NotificationRepository,
  TransitionNotificationDeliveryInput,
} from "@/lib/repositories/notification-repository";
import { createNotificationStorageError } from "@/lib/notifications/safe-error";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  target_url: string;
  metadata: Record<string, unknown> | null;
  created_by_member_id: string | null;
  created_at: string;
};

const NOTIFICATION_SELECT =
  "id,type,title,body,target_url,metadata,created_by_member_id,created_at";

const NOTIFICATION_CAMPAIGN_CLAIM_DISPOSITIONS = new Set<NotificationCampaignClaimDisposition>([
  "claimed",
  "resumed",
  "in_progress",
  "completed",
]);
const NOTIFICATION_DELIVERY_CLAIM_DISPOSITIONS = new Set<NotificationDeliveryClaimDisposition>([
  "claimed",
  "sent",
  "in_progress",
  "needs_reconciliation",
]);

type MemberNotificationRow = {
  id: string;
  notification_id: string;
  member_id: string;
  read_at: string | null;
  deleted_at: string | null;
  updated_at: string;
  created_at: string;
  notifications?: {
    id: string;
    type: string;
    title: string;
    body: string;
    target_url: string;
    metadata: Record<string, unknown> | null;
    created_by_member_id: string | null;
    created_at: string;
  } | {
    id: string;
    type: string;
    title: string;
    body: string;
    target_url: string;
    metadata: Record<string, unknown> | null;
    created_by_member_id: string | null;
    created_at: string;
  }[] | null;
};

function mapNotificationRow(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    targetUrl: row.target_url,
    metadata: row.metadata ?? {},
    createdByMemberId: row.created_by_member_id,
    createdAt: row.created_at,
  };
}

function mapMemberNotificationRow(row: MemberNotificationRow): MemberNotificationRecord {
  const notification = Array.isArray(row.notifications)
    ? row.notifications[0] ?? null
    : row.notifications;

  if (!notification) {
    throw new Error("알림을 찾을 수 없습니다.");
  }

  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    targetUrl: notification.target_url,
    metadata: notification.metadata ?? {},
    createdByMemberId: notification.created_by_member_id,
    createdAt: notification.created_at,
    memberNotificationId: row.id,
    memberId: row.member_id,
    readAt: row.read_at,
    deletedAt: row.deleted_at,
    updatedAt: row.updated_at,
    isUnread: row.read_at === null && row.deleted_at === null,
  };
}

export class SupabaseNotificationRepository implements NotificationRepository {
  async createNotification(
    input: NotificationBroadcastInput,
  ): Promise<CreateNotificationResult> {
    const targetUrl = normalizeNotificationTargetUrl(input.targetUrl);
    if (!targetUrl) {
      throw new Error("알림 이동 URL은 내부 경로여야 합니다.");
    }

    const supabase = getSupabaseAdminClient();
    const idempotencyKey = input.idempotencyKey?.trim() || null;
    const notificationInput = {
      type: input.type,
      title: input.title,
      body: input.body,
      target_url: targetUrl,
      metadata: input.metadata ?? {},
      created_by_member_id: input.createdByMemberId ?? null,
      idempotency_key: idempotencyKey,
    };

    const notificationResult = idempotencyKey
      ? await supabase
          .from("notifications")
          .upsert(notificationInput, {
            onConflict: "idempotency_key",
            ignoreDuplicates: true,
          })
          .select(NOTIFICATION_SELECT)
          .maybeSingle()
      : await supabase
          .from("notifications")
          .insert(notificationInput)
          .select(NOTIFICATION_SELECT)
          .single();

    let notificationData = notificationResult.data;
    if (!notificationData && idempotencyKey && !notificationResult.error) {
      const existingResult = await supabase
        .from("notifications")
        .select(NOTIFICATION_SELECT)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      notificationData = existingResult.data;
      if (existingResult.error) {
        throw createNotificationStorageError(existingResult.error);
      }
      if (notificationData) {
        return {
          notification: mapNotificationRow(notificationData as NotificationRow),
          recipientMemberIds: [],
          alreadyExists: true,
        };
      }
    }

    if (notificationResult.error) {
      throw createNotificationStorageError(notificationResult.error);
    }
    if (!notificationData) {
      throw new Error("알림을 저장하지 못했습니다.");
    }

    const notification = mapNotificationRow(notificationData as NotificationRow);
    const recipientMemberIds = Array.from(
      new Set((input.recipientMemberIds ?? []).filter((value) => value.trim().length > 0)),
    );

    await this.addNotificationRecipients(notification.id, recipientMemberIds);

    return { notification, recipientMemberIds };
  }

  async addNotificationRecipients(
    notificationId: string,
    recipientMemberIds: string[],
  ) {
    const normalizedRecipientIds = Array.from(
      new Set(recipientMemberIds.map((value) => value.trim()).filter(Boolean)),
    );
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.rpc("attach_notification_recipients", {
      p_notification_id: notificationId,
      p_recipient_member_ids: normalizedRecipientIds,
    });
    if (error) {
      throw createNotificationStorageError(error);
    }
  }

  async addNotificationAudienceRecipients(
    notificationId: string,
    audience: NotificationRecipientAudience,
  ) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("attach_notification_audience", {
      p_notification_id: notificationId,
      p_scope: audience.scope,
      p_generation: audience.year ?? null,
      p_campus: audience.campus ?? null,
      p_recipient_member_ids: Array.from(
        new Set((audience.memberIds ?? []).map((value) => value.trim()).filter(Boolean)),
      ),
    });
    if (error) {
      throw createNotificationStorageError(error);
    }
    if (typeof data !== "number" || !Number.isSafeInteger(data) || data < 0) {
      throw new Error("알림 수신자 저장 결과를 확인하지 못했습니다.");
    }
    return data;
  }

  async claimNotificationCampaign(
    input: NotificationCampaignClaimInput,
  ): Promise<NotificationCampaignClaimResult> {
    const targetUrl = normalizeNotificationTargetUrl(input.targetUrl);
    const idempotencyKey = input.idempotencyKey.trim();
    if (!targetUrl || !idempotencyKey) {
      throw new Error("알림 발송 요청이 올바르지 않습니다.");
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("claim_notification_campaign", {
      p_type: input.type,
      p_title: input.title,
      p_body: input.body,
      p_target_url: targetUrl,
      p_metadata: input.metadata ?? {},
      p_created_by_member_id: input.createdByMemberId ?? null,
      p_idempotency_key: idempotencyKey,
      p_recipient_member_ids: Array.from(
        new Set(input.recipientMemberIds.filter((value) => value.trim().length > 0)),
      ),
      p_lease_seconds: input.leaseDurationSeconds,
    });
    if (error) {
      throw createNotificationStorageError(error);
    }

    const result = data as {
      disposition?: unknown;
      attempt_token?: unknown;
      notification?: NotificationRow | null;
      recipient_member_ids?: unknown;
    } | null;
    const disposition = result?.disposition;
    if (
      typeof disposition !== "string" ||
      !NOTIFICATION_CAMPAIGN_CLAIM_DISPOSITIONS.has(
        disposition as NotificationCampaignClaimDisposition,
      ) ||
      !result?.notification
    ) {
      throw new Error("알림 캠페인 실행 상태를 확인하지 못했습니다.");
    }

    const attemptToken =
      typeof result.attempt_token === "string" ? result.attempt_token : null;
    if (
      (disposition === "claimed" || disposition === "resumed") &&
      !attemptToken
    ) {
      throw new Error("알림 캠페인 실행 토큰을 확인하지 못했습니다.");
    }
    const recipientMemberIds = Array.isArray(result.recipient_member_ids)
      ? result.recipient_member_ids.filter(
          (value): value is string => typeof value === "string",
        )
      : [];

    return {
      notification: mapNotificationRow(result.notification),
      recipientMemberIds,
      disposition: disposition as NotificationCampaignClaimDisposition,
      attemptToken,
    };
  }

  async finalizeNotificationCampaign(
    input: FinalizeNotificationCampaignInput,
  ) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("finalize_notification_campaign", {
      p_notification_id: input.notificationId,
      p_attempt_token: input.attemptToken,
      p_metadata: input.metadata,
    });
    if (error) {
      throw createNotificationStorageError(error);
    }
    return data === true;
  }

  async claimNotificationDelivery(
    input: NotificationDeliveryClaimInput,
  ): Promise<NotificationDeliveryClaimResult> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("claim_notification_delivery", {
      p_notification_id: input.notificationId,
      p_member_id: input.memberId,
      p_channel: input.channel,
      p_provider: input.provider,
      p_provider_campaign_id: input.providerCampaignId ?? null,
      p_provider_idempotency_key: input.providerIdempotencyKey,
      p_lease_seconds: input.leaseDurationSeconds,
    });
    if (error) {
      throw createNotificationStorageError(error);
    }

    const result = data as {
      delivery_id?: unknown;
      disposition?: unknown;
    } | null;
    const disposition = result?.disposition;
    if (
      typeof result?.delivery_id !== "string" ||
      typeof disposition !== "string" ||
      !NOTIFICATION_DELIVERY_CLAIM_DISPOSITIONS.has(
        disposition as NotificationDeliveryClaimDisposition,
      )
    ) {
      throw new Error("알림 전송 실행 상태를 확인하지 못했습니다.");
    }

    return {
      deliveryId: result.delivery_id,
      disposition: disposition as NotificationDeliveryClaimDisposition,
    };
  }

  async transitionNotificationDelivery(
    input: TransitionNotificationDeliveryInput,
  ) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc(
      "transition_notification_delivery",
      {
        p_delivery_id: input.deliveryId,
        p_transition: input.transition,
        p_error_message: input.errorMessage ?? null,
      },
    );
    if (error) {
      throw createNotificationStorageError(error);
    }
    return data === true;
  }

  async recordNotificationDelivery(input: NotificationDeliveryInput) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("notification_deliveries").insert({
      notification_id: input.notificationId,
      member_id: input.memberId,
      channel: input.channel,
      status: input.status,
      error_message: input.errorMessage ?? null,
      provider: input.provider ?? null,
      provider_notification_id: input.providerNotificationId ?? null,
      provider_campaign_id: input.providerCampaignId ?? null,
      provider_idempotency_key: input.providerIdempotencyKey ?? null,
      provider_status: input.providerStatus ?? null,
      delivered_at: input.deliveredAt ?? (input.status === "sent" ? new Date().toISOString() : null),
    });
    if (error) {
      throw createNotificationStorageError(error);
    }
  }

  async updateNotificationMetadata(
    notificationId: string,
    metadata: Record<string, unknown>,
  ) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("notifications")
      .update({ metadata })
      .eq("id", notificationId);
    if (error) {
      throw createNotificationStorageError(error);
    }
  }

  async getUnreadNotificationCount(memberId: string) {
    const supabase = getSupabaseAdminClient();
    const { count, error } = await supabase
      .from("member_notifications")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .is("deleted_at", null)
      .is("read_at", null);

    if (error) {
      throw createNotificationStorageError(error);
    }

    return count ?? 0;
  }

  async listMemberNotifications(
    context: NotificationListContext,
  ): Promise<NotificationListResult> {
    const limit = Math.max(1, Math.min(20, context.limit ?? 10));
    const offset = Math.max(0, context.offset ?? 0);
    const supabase = getSupabaseAdminClient();

    const unreadPromise = supabase
      .from("member_notifications")
      .select("id", { count: "exact", head: true })
      .eq("member_id", context.memberId)
      .is("deleted_at", null)
      .is("read_at", null);

    const listPromise = supabase
      .from("member_notifications")
      .select(
        "id,notification_id,member_id,read_at,deleted_at,updated_at,created_at,notifications!inner(id,type,title,body,target_url,metadata,created_by_member_id,created_at)",
      )
      .eq("member_id", context.memberId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit);

    const [{ count, error: unreadError }, { data, error: listError }] =
      await Promise.all([unreadPromise, listPromise]);

    if (unreadError) {
      throw createNotificationStorageError(unreadError);
    }
    if (listError) {
      throw createNotificationStorageError(listError);
    }

    const rows = (data ?? []) as MemberNotificationRow[];
    const items = rows.slice(0, limit).map(mapMemberNotificationRow);

    return {
      unreadCount: count ?? 0,
      items,
      nextOffset: offset + items.length,
      hasMore: rows.length > limit,
    };
  }

  async getMemberNotification(memberId: string, notificationId: string) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("member_notifications")
      .select(
        "id,notification_id,member_id,read_at,deleted_at,updated_at,created_at,notifications!inner(id,type,title,body,target_url,metadata,created_by_member_id,created_at)",
      )
      .eq("member_id", memberId)
      .eq("notification_id", notificationId)
      .maybeSingle();

    if (error) {
      throw createNotificationStorageError(error);
    }
    if (!data) {
      return null;
    }

    return mapMemberNotificationRow(data as MemberNotificationRow);
  }

  async markMemberNotificationRead(memberId: string, notificationId: string) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("member_notifications")
      .update({
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("member_id", memberId)
      .eq("notification_id", notificationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      throw createNotificationStorageError(error);
    }
    return Boolean(data);
  }

  async softDeleteMemberNotification(memberId: string, notificationId: string) {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("member_notifications")
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .eq("member_id", memberId)
      .eq("notification_id", notificationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      throw createNotificationStorageError(error);
    }
    return Boolean(data);
  }

  async markAllMemberNotificationsRead(memberId: string) {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("member_notifications")
      .update({
        read_at: now,
        updated_at: now,
      })
      .eq("member_id", memberId)
      .is("deleted_at", null)
      .is("read_at", null)
      .select("id");

    if (error) {
      throw createNotificationStorageError(error);
    }
    return data?.length ?? 0;
  }

  async softDeleteAllMemberNotifications(memberId: string) {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("member_notifications")
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .eq("member_id", memberId)
      .is("deleted_at", null)
      .select("id");

    if (error) {
      throw createNotificationStorageError(error);
    }
    return data?.length ?? 0;
  }
}
