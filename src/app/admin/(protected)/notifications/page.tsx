import AdminOperationalNotificationCenter, {
  type AdminOperationalNotificationItem,
} from "@/components/admin/AdminOperationalNotificationCenter";
import AdminOperationalNotificationSettingsPanel from "@/components/admin/AdminOperationalNotificationSettingsPanel";
import AdminShell from "@/components/admin/AdminShell";
import SectionHeading from "@/components/ui/SectionHeading";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  getAdminOperationalNotificationPreferences,
  listOperationalPushSubscriptionDevices,
} from "@/lib/operational-notifications";
import { getPushPublicKey, isPushConfigured } from "@/lib/push";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminNotificationRelation = {
  id?: string | null;
  type?: string | null;
  title?: string | null;
  body?: string | null;
  target_url?: string | null;
  created_at?: string | null;
};

type AdminNotificationRecipientRow = {
  id?: string | null;
  read_at?: string | null;
  created_at?: string | null;
  notification?: AdminNotificationRelation | AdminNotificationRelation[] | null;
};

function normalizeNotificationRelation(
  value: AdminNotificationRecipientRow["notification"],
) {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapNotificationItem(
  row: AdminNotificationRecipientRow,
): AdminOperationalNotificationItem | null {
  const notification = normalizeNotificationRelation(row.notification);
  if (!row.id || !notification?.id) {
    return null;
  }
  return {
    recipientId: row.id,
    notificationId: notification.id,
    type: notification.type ?? "notification",
    title: notification.title ?? "운영 알림",
    body: notification.body ?? "",
    targetUrl: notification.target_url ?? "/admin",
    readAt: row.read_at ?? null,
    createdAt: notification.created_at ?? row.created_at ?? new Date(0).toISOString(),
  };
}

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
        "id,read_at,created_at,notification:admin_notifications(id,type,title,body,target_url,created_at)",
      )
      .eq("admin_id", session.adminId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
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

  const items = ((inboxResult.data ?? []) as AdminNotificationRecipientRow[])
    .map(mapNotificationItem)
    .filter((item): item is AdminOperationalNotificationItem => item !== null);
  const unreadCount = unreadResult.count ?? 0;

  return (
    <AdminShell title="운영 알림" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Operational Notifications"
          title="운영 알림"
          description="파트너 변경 요청, 종료 임박, 보안 이벤트를 회원 알림과 분리해 관리합니다."
        />
        <StatsRow
          items={[
            {
              label: "읽지 않음",
              value: `${unreadCount.toLocaleString("ko-KR")}건`,
              hint: "현재 관리자 수신함",
            },
            {
              label: "최근 알림",
              value: `${items.length.toLocaleString("ko-KR")}건`,
              hint: "최대 50건 표시",
            },
            {
              label: "푸시 기기",
              value: `${devices.length.toLocaleString("ko-KR")}개`,
              hint: isPushConfigured() ? "웹푸시 구성됨" : "웹푸시 미구성",
            },
          ]}
          minItemWidth="13rem"
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.75fr)] xl:items-start">
          <section className="grid gap-4">
            <SectionHeading
              title="수신함"
              description="운영 이벤트별 알림을 확인하고 필요한 작업 화면으로 이동합니다."
            />
            <AdminOperationalNotificationCenter
              items={items}
              unreadCount={unreadCount}
            />
          </section>
          <section className="grid gap-4 xl:sticky xl:top-24">
            <SectionHeading
              title="수신 설정"
              description="관리자 인앱 알림과 웹푸시 수신 여부를 계정별로 관리합니다."
            />
            <AdminOperationalNotificationSettingsPanel
              pushConfigured={isPushConfigured()}
              publicKey={getPushPublicKey()}
              preferences={preferences}
              deviceCount={devices.length}
            />
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
