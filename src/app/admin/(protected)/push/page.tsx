import AdminPushManager from "@/components/admin/AdminPushManager";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import ShellHeader from "@/components/ui/ShellHeader";
import {
  getAutomaticNotificationRuleSummaries,
  getRecentAdminNotificationOperationLogs,
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
    recentLogs,
    automaticSummaries,
  ] = await Promise.all([
    supabase
      .from("members")
      .select("id,display_name,mm_username,year,campus")
      .order("year", { ascending: true })
      .order("campus", { ascending: true })
      .order("display_name", { ascending: true }),
    supabase.from("partners").select("id,name").order("name", { ascending: true }),
    getRecentAdminNotificationOperationLogs(50),
    getAutomaticNotificationRuleSummaries(30),
  ]);

  const partners = partnerResult.error ? [] : partnerResult.data ?? [];
  const safeMembers = memberResult.error ? [] : memberResult.data ?? [];

  return (
    <AdminShell title="통합 알림 운영" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Notifications"
          title="통합 알림 운영"
          description="운영 공지와 마케팅을 검토 후 발송하고, 신규 제휴와 종료 임박 자동 알림 상태까지 함께 봅니다."
        />
          <div className="mt-6">
            <AdminPushManager
              pushConfigured={isPushConfigured()}
              mattermostConfigured={isMattermostNotificationConfigured()}
              partners={partners}
              members={safeMembers}
              recentLogs={recentLogs}
              automaticSummaries={automaticSummaries}
            />
          </div>
      </div>
    </AdminShell>
  );
}
