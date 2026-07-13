import AdminNotificationsView from "@/components/admin/AdminNotificationsView";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  buildAdminNotificationListResult,
  type AdminNotificationRecipientRow,
} from "@/lib/admin-notification-inbox";
import {
  getAdminOperationalNotificationPreferences,
  listOperationalPushSubscriptionDevices,
} from "@/lib/operational-notifications";
import { getPushPublicKey, isPushConfigured } from "@/lib/push";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const session = await requireAdminPermission("notifications", "read", {
    path: "/admin/notifications",
  });
  const supabase = getSupabaseAdminClient();

  const [unreadResult, inboxResult, preferences, devices] = await Promise.all([
    supabase
      .from("admin_notification_recipients")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", session.adminId)
      .is("deleted_at", null)
      .is("read_at", null),
    supabase
      .from("admin_notification_recipients")
      .select(
        "id,read_at,deleted_at,created_at,updated_at,notification:admin_notifications(id,type,title,body,target_url,metadata,created_at)",
      )
      .eq("admin_id", session.adminId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(0, 10),
    getAdminOperationalNotificationPreferences(session.adminId),
    listOperationalPushSubscriptionDevices({
      ownerType: "admin",
      ownerId: session.adminId,
    }),
  ]);

  if (unreadResult.error) {
    throw new Error(unreadResult.error.message);
  }
  if (inboxResult.error) {
    throw new Error(inboxResult.error.message);
  }

  const notificationResult = buildAdminNotificationListResult({
    unreadCount: unreadResult.count ?? 0,
    rows: (inboxResult.data ?? []) as AdminNotificationRecipientRow[],
    offset: 0,
    limit: 10,
  });

  return (
    <AdminShell title="내 알림" backHref="/admin" backLabel="관리 홈">
      <AdminNotificationsView
        notificationResult={notificationResult}
        preferences={preferences}
        deviceCount={devices.length}
        pushConfigured={isPushConfigured()}
        publicKey={getPushPublicKey()}
      />
    </AdminShell>
  );
}
