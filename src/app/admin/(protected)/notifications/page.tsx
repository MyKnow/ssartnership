import AdminNotificationInbox from "@/components/admin/AdminNotificationInbox";
import AdminOperationalNotificationSettingsPanel from "@/components/admin/AdminOperationalNotificationSettingsPanel";
import AdminShell from "@/components/admin/AdminShell";
import SectionHeading from "@/components/ui/SectionHeading";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
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
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Admin Notifications"
          title="내 알림"
          description="관리자 계정으로 수신한 변경 요청, 종료 임박, 보안 알림을 확인합니다."
        />
        <StatsRow
          items={[
            {
              label: "읽지 않음",
              value: `${notificationResult.unreadCount.toLocaleString("ko-KR")}건`,
              hint: "현재 관리자 수신함",
            },
            {
              label: "표시 중",
              value: `${notificationResult.items.length.toLocaleString("ko-KR")}건`,
              hint: notificationResult.hasMore ? "더보기 가능" : "현재 목록 전체",
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
              title="관리자 수신함"
              description="사용자 알림 페이지와 같은 방식으로 읽음, 삭제, 이동 작업을 처리합니다."
            />
            <AdminNotificationInbox initialState={notificationResult} />
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
