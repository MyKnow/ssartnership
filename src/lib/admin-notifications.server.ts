import { revalidateTag, unstable_cache } from "next/cache";
import {
  buildAdminNotificationListResult,
  type AdminNotificationRecipientRow,
  type AdminNotificationListResult,
} from "@/lib/admin-notification-inbox";
import {
  countOperationalPushSubscriptionDevices,
  getAdminOperationalNotificationPreferences,
} from "@/lib/operational-notifications";
import { getDefaultAdminNotificationPreferences } from "@/lib/partner-notification-routing";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function createUnavailableAdminNotificationsReadModel() {
  return {
    notificationResult: buildAdminNotificationListResult({
      unreadCount: 0,
      rows: [],
      offset: 0,
      limit: 10,
      hasMore: false,
    }),
    preferences: getDefaultAdminNotificationPreferences(),
    deviceCount: 0,
    loadError: true,
  };
}

const ADMIN_NOTIFICATION_READ_CACHE_REVALIDATE_SECONDS = 3;
const ADMIN_NOTIFICATION_SETTINGS_CACHE_REVALIDATE_SECONDS = 3;

type AdminNotificationInboxReadModel = {
  notificationResult: AdminNotificationListResult;
  loadError: boolean;
};

function getAdminNotificationReadCacheTag(adminId: string) {
  return `admin-notifications:${adminId}`;
}

function getAdminNotificationSettingsCacheTag(adminId: string) {
  return `admin-notification-settings:${adminId}`;
}

function getCachedAdminNotificationPreferences(adminId: string) {
  return unstable_cache(
    () => getAdminOperationalNotificationPreferences(adminId),
    ["admin-notification-preferences", adminId],
    {
      revalidate: ADMIN_NOTIFICATION_SETTINGS_CACHE_REVALIDATE_SECONDS,
      tags: [getAdminNotificationSettingsCacheTag(adminId)],
    },
  )();
}

function getCachedAdminNotificationDeviceCount(adminId: string) {
  return unstable_cache(
    () =>
      countOperationalPushSubscriptionDevices({
        ownerType: "admin",
        ownerId: adminId,
      }),
    ["admin-notification-device-count", adminId],
    {
      revalidate: ADMIN_NOTIFICATION_SETTINGS_CACHE_REVALIDATE_SECONDS,
      tags: [getAdminNotificationSettingsCacheTag(adminId)],
    },
  )();
}

async function getAdminNotificationInboxReadModelUncached({
  adminId,
  offset,
  limit,
  includeUnreadCount,
}: {
  adminId: string;
  offset: number;
  limit: number;
  includeUnreadCount: boolean;
}): Promise<AdminNotificationInboxReadModel> {
  try {
    const supabase = getSupabaseAdminClient();
    const [unreadResult, inboxResult] = await Promise.all([
      includeUnreadCount
        ? supabase
            .from("admin_notification_recipients")
            .select("id", { count: "exact", head: true })
            .eq("admin_id", adminId)
            .is("deleted_at", null)
            .is("read_at", null)
        : Promise.resolve({ count: 0, error: null }),
      supabase
        .from("admin_notification_recipients")
        .select(
          "id,read_at,deleted_at,created_at,updated_at,notification:admin_notifications(id,type,title,body,target_url,metadata,created_at)",
        )
        .eq("admin_id", adminId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit),
    ]);

    if (unreadResult.error || inboxResult.error) {
      return {
        notificationResult: buildAdminNotificationListResult({
          unreadCount: 0,
          rows: [],
          offset,
          limit,
          hasMore: false,
        }),
        loadError: true,
      };
    }

    return {
      notificationResult: buildAdminNotificationListResult({
        unreadCount: unreadResult.count ?? 0,
        rows: (inboxResult.data ?? []) as AdminNotificationRecipientRow[],
        offset,
        limit,
      }),
      loadError: false,
    };
  } catch {
    return {
      notificationResult: buildAdminNotificationListResult({
        unreadCount: 0,
        rows: [],
        offset,
        limit,
        hasMore: false,
      }),
      loadError: true,
    };
  }
}

export async function getCachedAdminNotificationInboxReadModel({
  adminId,
  offset = 0,
  limit = 10,
  includeUnreadCount = true,
}: {
  adminId: string;
  offset?: number;
  limit?: number;
  includeUnreadCount?: boolean;
}) {
  return unstable_cache(
    () =>
      getAdminNotificationInboxReadModelUncached({
        adminId,
        offset,
        limit,
        includeUnreadCount,
      }),
    [
      "admin-notification-inbox",
      adminId,
      String(offset),
      String(limit),
      includeUnreadCount ? "with-unread-count" : "without-unread-count",
    ],
    {
      revalidate: ADMIN_NOTIFICATION_READ_CACHE_REVALIDATE_SECONDS,
      tags: [getAdminNotificationReadCacheTag(adminId)],
    },
  )();
}

export function invalidateAdminNotificationReadCache(adminId: string) {
  revalidateTag(getAdminNotificationReadCacheTag(adminId), "max");
}

export function invalidateAdminNotificationSettingsCache(adminId: string) {
  revalidateTag(getAdminNotificationSettingsCacheTag(adminId), "max");
}

/**
 * Server read model for one administrator's inbox and notification controls.
 * It deliberately turns expected read failures into a safe UI state rather
 * than leaking a database error through the route error boundary.
 */
export async function getAdminNotificationsReadModel(adminId: string) {
  try {
    const [notificationReadModel, preferences, devices] = await Promise.all([
      getCachedAdminNotificationInboxReadModel({
        adminId,
        offset: 0,
        limit: 10,
        includeUnreadCount: true,
      }),
      getCachedAdminNotificationPreferences(adminId),
      getCachedAdminNotificationDeviceCount(adminId),
    ]);
    if (notificationReadModel.loadError) {
      return createUnavailableAdminNotificationsReadModel();
    }

    return {
      notificationResult: notificationReadModel.notificationResult,
      preferences,
      deviceCount: devices,
      loadError: false,
    };
  } catch {
    return createUnavailableAdminNotificationsReadModel();
  }
}
