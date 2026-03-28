import AdminPushManager from "@/components/admin/AdminPushManager";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import { isPushConfigured } from "@/lib/push";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPushPage() {
  const supabase = getSupabaseAdminClient();

  const [activeSubscriptionResult, enabledMemberResult] = await Promise.all([
    supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("push_preferences")
      .select("member_id", { count: "exact", head: true })
      .eq("enabled", true),
  ]);

  const activeSubscriptions = activeSubscriptionResult.error
    ? 0
    : activeSubscriptionResult.count ?? 0;
  const enabledMembers = enabledMemberResult.error
    ? 0
    : enabledMemberResult.count ?? 0;

  return (
    <AdminShell
      title="푸시 알림 관리"
      description="전체 공지 발송과 자동 Web Push 알림 상태를 관리합니다."
      backHref="/admin"
      backLabel="관리 홈"
    >
      <Card>
        <SectionHeading
          title="푸시 알림 관리"
          description="전체 공지는 수동 발송하고, 신규 제휴와 종료 7일 전 알림은 자동 발송됩니다."
        />
        <div className="mt-6">
          <AdminPushManager
            configured={isPushConfigured()}
            activeSubscriptions={activeSubscriptions}
            enabledMembers={enabledMembers}
          />
        </div>
      </Card>
    </AdminShell>
  );
}
