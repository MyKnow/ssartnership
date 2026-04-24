import AdminPushManager from "@/components/admin/AdminPushManager";
import AdminShell from "@/components/admin/AdminShell";
import ShellHeader from "@/components/ui/ShellHeader";
import {
  getAdminNotificationOverview,
  isMattermostNotificationConfigured,
} from "@/lib/admin-notification-ops";
import { isPushConfigured } from "@/lib/push";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPushPage() {
  const supabase = getSupabaseAdminClient();

  const [
    memberResult,
    partnerResult,
    notificationOverview,
  ] = await Promise.all([
    supabase
      .from("members")
      .select("id,display_name,mm_username,year,campus")
      .order("year", { ascending: true })
      .order("campus", { ascending: true })
      .order("display_name", { ascending: true }),
    supabase.from("partners").select("id,name").order("name", { ascending: true }),
    getAdminNotificationOverview(50, 30),
  ]);

  const partners = partnerResult.error ? [] : partnerResult.data ?? [];
  const safeMembers = memberResult.error ? [] : memberResult.data ?? [];

  return (
    <AdminShell title="알림 전송" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Notifications"
          title="알림 전송"
          description="운영 공지와 마케팅 메시지를 작성해 발송합니다. 발송 결과와 운영 로그는 알림센터에서 확인합니다."
        />
          <div className="mt-6">
            <AdminPushManager
              pushConfigured={isPushConfigured()}
              mattermostConfigured={isMattermostNotificationConfigured()}
              partners={partners}
              members={safeMembers}
              recentLogs={notificationOverview.recentLogs}
              automaticSummaries={notificationOverview.automaticSummaries}
            />
          </div>
      </div>
    </AdminShell>
  );
}
