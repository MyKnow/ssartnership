import { createNotificationStorageError } from "@/lib/notifications/safe-error";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type AdminStoredNotificationMutationParams = {
  adminId: string;
  notificationIds?: string[] | null;
  now?: string;
};

type AdminStoredNotificationMutationResult = {
  unreadCount: number;
  updatedCount: number;
};

type AdminStoredNotificationRepository = {
  countUnread(params: { adminId: string }): Promise<number>;
  markRead(params: {
    adminId: string;
    notificationIds?: string[] | null;
    now: string;
  }): Promise<number>;
  softDelete(params: {
    adminId: string;
    notificationIds?: string[] | null;
    now: string;
  }): Promise<number>;
};

function createSupabaseAdminStoredNotificationRepository(): AdminStoredNotificationRepository {
  return {
    async countUnread({ adminId }) {
      const supabase = getSupabaseAdminClient();
      const { count, error } = await supabase
        .from("admin_notification_recipients")
        .select("id", { count: "exact", head: true })
        .eq("admin_id", adminId)
        .is("deleted_at", null)
        .is("read_at", null);

      if (error) {
        throw createNotificationStorageError(error);
      }

      return count ?? 0;
    },

    async markRead({ adminId, notificationIds, now }) {
      const supabase = getSupabaseAdminClient();
      let query = supabase
        .from("admin_notification_recipients")
        .update({ read_at: now, updated_at: now }, { count: "exact" })
        .eq("admin_id", adminId)
        .is("deleted_at", null)
        .is("read_at", null);
      if (notificationIds && notificationIds.length > 0) {
        query = query.in("notification_id", notificationIds);
      }
      const { count, error } = await query;

      if (error) {
        throw createNotificationStorageError(error);
      }

      return count ?? 0;
    },

    async softDelete({ adminId, notificationIds, now }) {
      const supabase = getSupabaseAdminClient();
      let query = supabase
        .from("admin_notification_recipients")
        .update({ deleted_at: now, updated_at: now }, { count: "exact" })
        .eq("admin_id", adminId)
        .is("deleted_at", null);
      if (notificationIds && notificationIds.length > 0) {
        query = query.in("notification_id", notificationIds);
      }
      const { count, error } = await query;

      if (error) {
        throw createNotificationStorageError(error);
      }

      return count ?? 0;
    },
  };
}

export function createAdminStoredNotificationService(
  repository: AdminStoredNotificationRepository,
) {
  async function getNoopResult(adminId: string) {
    return {
      unreadCount: await repository.countUnread({ adminId }),
      updatedCount: 0,
    };
  }

  return {
    async markRead(
      params: AdminStoredNotificationMutationParams,
    ): Promise<AdminStoredNotificationMutationResult> {
      if (params.notificationIds && params.notificationIds.length === 0) {
        return getNoopResult(params.adminId);
      }

      const updatedCount = await repository.markRead({
        adminId: params.adminId,
        notificationIds: params.notificationIds,
        now: params.now ?? new Date().toISOString(),
      });
      const unreadCount = await repository.countUnread({
        adminId: params.adminId,
      });

      return { unreadCount, updatedCount };
    },

    async remove(
      params: AdminStoredNotificationMutationParams,
    ): Promise<AdminStoredNotificationMutationResult> {
      if (params.notificationIds && params.notificationIds.length === 0) {
        return getNoopResult(params.adminId);
      }

      const updatedCount = await repository.softDelete({
        adminId: params.adminId,
        notificationIds: params.notificationIds,
        now: params.now ?? new Date().toISOString(),
      });
      const unreadCount = await repository.countUnread({
        adminId: params.adminId,
      });

      return { unreadCount, updatedCount };
    },
  };
}

const activeAdminStoredNotificationService =
  createAdminStoredNotificationService(
    createSupabaseAdminStoredNotificationRepository(),
  );

export async function markAdminStoredNotificationsRead(
  params: AdminStoredNotificationMutationParams,
) {
  return activeAdminStoredNotificationService.markRead(params);
}

export async function deleteAdminStoredNotifications(
  params: AdminStoredNotificationMutationParams,
) {
  return activeAdminStoredNotificationService.remove(params);
}
