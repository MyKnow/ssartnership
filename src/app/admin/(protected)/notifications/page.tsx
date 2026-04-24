import AdminNotificationCenter from "@/components/admin/notification-center/AdminNotificationCenter";
import AdminShell from "@/components/admin/AdminShell";
import ShellHeader from "@/components/ui/ShellHeader";
import { getAdminNotificationOverview } from "@/lib/admin-notification-ops";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const { recentLogs, automaticSummaries } = await getAdminNotificationOverview(100, 30);

  return (
    <AdminShell title="알림센터" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Notifications"
          title="알림센터"
          description="발송 결과와 실패, 예약/즉시 발송, 대상자 요약을 조회합니다."
        />
        <AdminNotificationCenter
          recentLogs={recentLogs}
          automaticSummaries={automaticSummaries}
        />
      </div>
    </AdminShell>
  );
}
