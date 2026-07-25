import {
  buildAdminNotificationListResult,
  type AdminNotificationRecipientRow,
} from "@/lib/admin-notification-inbox";
import {
  getAdminOperationalNotificationPreferences,
  listOperationalPushSubscriptionDevices,
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

/**
 * Server read model for one administrator's inbox and notification controls.
 * It deliberately turns expected read failures into a safe UI state rather
 * than leaking a database error through the route error boundary.
 */
export async function getAdminNotificationsReadModel(adminId: string) {
  try {
    const supabase = getSupabaseAdminClient();
    const [unreadResult, inboxResult, preferences, devices] = await Promise.all([
      supabase
        .from("admin_notification_recipients")
        .select("id", { count: "exact", head: true })
        .eq("admin_id", adminId)
        .is("deleted_at", null)
        .is("read_at", null),
      supabase
        .from("admin_notification_recipients")
        .select(
          "id,read_at,deleted_at,created_at,updated_at,notification:admin_notifications(id,type,title,body,target_url,metadata,created_at)",
        )
        .eq("admin_id", adminId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(0, 10),
      getAdminOperationalNotificationPreferences(adminId),
      listOperationalPushSubscriptionDevices({
        ownerType: "admin",
        ownerId: adminId,
      }),
    ]);
    if (unreadResult.error || inboxResult.error) {
      return createUnavailableAdminNotificationsReadModel();
    }

    return {
      notificationResult: buildAdminNotificationListResult({
        unreadCount: unreadResult.count ?? 0,
        rows: (inboxResult.data ?? []) as AdminNotificationRecipientRow[],
        offset: 0,
        limit: 10,
      }),
      preferences,
      deviceCount: devices.length,
      loadError: false,
    };
  } catch {
    return createUnavailableAdminNotificationsReadModel();
  }
}
