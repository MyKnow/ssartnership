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
  NotificationListContext,
  NotificationRepository,
} from "@/lib/repositories/notification-repository";

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
    const { data: notificationData, error: notificationError } = await supabase
      .from("notifications")
      .insert({
        type: input.type,
        title: input.title,
        body: input.body,
        target_url: targetUrl,
        metadata: input.metadata ?? {},
        created_by_member_id: input.createdByMemberId ?? null,
      })
      .select("id,type,title,body,target_url,metadata,created_by_member_id,created_at")
      .single();

    if (notificationError) {
      throw new Error(notificationError.message);
    }

    const notification = mapNotificationRow(notificationData as NotificationRow);
    const recipientMemberIds = Array.from(
      new Set((input.recipientMemberIds ?? []).filter((value) => value.trim().length > 0)),
    );

    if (recipientMemberIds.length > 0) {
      const now = new Date().toISOString();
      const memberNotificationRows = recipientMemberIds.map((memberId) => ({
        notification_id: notification.id,
        member_id: memberId,
        read_at: null,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      }));

      const deliveryRows = recipientMemberIds.map((memberId) => ({
        notification_id: notification.id,
        member_id: memberId,
        channel: "in_app",
        status: "sent",
        delivered_at: now,
      }));

      const { error: memberNotificationError } = await supabase
        .from("member_notifications")
        .insert(memberNotificationRows);
      if (memberNotificationError) {
        throw new Error(memberNotificationError.message);
      }

      const { error: deliveryError } = await supabase
        .from("notification_deliveries")
        .insert(deliveryRows);
      if (deliveryError) {
        throw new Error(deliveryError.message);
      }
    }

    return { notification, recipientMemberIds };
  }

  async recordNotificationDelivery(input: NotificationDeliveryInput) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("notification_deliveries").insert({
      notification_id: input.notificationId,
      member_id: input.memberId,
      channel: input.channel,
      status: input.status,
      error_message: input.errorMessage ?? null,
      delivered_at: input.deliveredAt ?? (input.status === "sent" ? new Date().toISOString() : null),
    });
    if (error) {
      throw new Error(error.message);
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
      throw new Error(error.message);
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
      throw new Error(error.message);
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
      .range(offset, offset + limit);

    const [{ count, error: unreadError }, { data, error: listError }] =
      await Promise.all([unreadPromise, listPromise]);

    if (unreadError) {
      throw new Error(unreadError.message);
    }
    if (listError) {
      throw new Error(listError.message);
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
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }

    return mapMemberNotificationRow(data as MemberNotificationRow);
  }

  async markMemberNotificationRead(memberId: string, notificationId: string) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("member_notifications")
      .update({
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("member_id", memberId)
      .eq("notification_id", notificationId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(error.message);
    }
    return true;
  }

  async softDeleteMemberNotification(memberId: string, notificationId: string) {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("member_notifications")
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .eq("member_id", memberId)
      .eq("notification_id", notificationId)
      .is("deleted_at", null);

    if (error) {
      throw new Error(error.message);
    }
    return true;
  }
}
