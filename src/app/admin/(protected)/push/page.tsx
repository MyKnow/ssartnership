import AdminPushManager from "@/components/admin/AdminPushManager";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import ShellHeader from "@/components/ui/ShellHeader";
import {
  getActiveSubscriptionPushPreferences,
  getRecentPushMessageLogs,
  isPushConfigured,
} from "@/lib/push";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPushPage() {
  const supabase = getSupabaseAdminClient();

  const [
    activeSubscriptionResult,
    activeSubscriptionMembersResult,
    enabledPreferenceMembersResult,
    partnerResult,
    recentLogs,
  ] = await Promise.all([
    supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("push_subscriptions")
      .select("member_id")
      .eq("is_active", true),
    supabase
      .from("push_preferences")
      .select("member_id,enabled,announcement_enabled"),
    supabase.from("partners").select("id,name").order("name", { ascending: true }),
    getRecentPushMessageLogs(50),
  ]);

  const activeSubscriptions = activeSubscriptionResult.error
    ? 0
    : activeSubscriptionResult.count ?? 0;
  const partners = partnerResult.error ? [] : partnerResult.data ?? [];
  const activeMemberIds = Array.from(
    new Set((activeSubscriptionMembersResult.data ?? []).map((item) => item.member_id)),
  );
  const preferenceMap = new Map(
    (enabledPreferenceMembersResult.data ?? []).map((item) => [
      item.member_id,
      getActiveSubscriptionPushPreferences({
        enabled: item.enabled,
        announcementEnabled: item.announcement_enabled,
      }),
    ]),
  );
  const targetableMemberIds = activeMemberIds.filter((memberId) => {
    const preference = getActiveSubscriptionPushPreferences(
      preferenceMap.get(memberId),
    );
    return Boolean(preference.enabled && preference.announcementEnabled);
  });
  const enabledMembers = targetableMemberIds.length;

  const { data: members, error: membersError } = targetableMemberIds.length
      ? await supabase
      .from("members")
      .select("id,display_name,mm_username,year,campus")
      .in("id", targetableMemberIds)
      .order("year", { ascending: true })
      .order("campus", { ascending: true })
      .order("display_name", { ascending: true })
    : { data: [], error: null };

  return (
    <AdminShell title="푸시 알림 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Push"
          title="푸시 알림 운영"
          description="전체 공지는 수동 발송하고, 신규 제휴와 종료 7일 전 알림은 자동 발송됩니다."
        />
        <Card tone="elevated">
          <div className="mt-6">
            <AdminPushManager
              configured={isPushConfigured()}
              activeSubscriptions={activeSubscriptions}
              enabledMembers={enabledMembers}
              partners={partners}
              members={membersError ? [] : members ?? []}
              recentLogs={recentLogs}
            />
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
