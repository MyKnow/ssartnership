import AdminPushManager from "@/components/admin/AdminPushManager";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
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
  const recentLogCount = notificationOverview.recentLogs.length;
  const automaticSummaryCount = notificationOverview.automaticSummaries.length;

  return (
    <AdminShell title="알림 전송" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Notifications"
          title="알림 전송"
          description="운영 공지와 마케팅 메시지를 작성해 발송합니다. 발송 결과와 운영 로그는 알림센터에서 확인합니다."
        />
        <StatsRow
          items={[
            { label: "회원 대상", value: `${safeMembers.length.toLocaleString()}명`, hint: "개인·기수·캠퍼스 기준" },
            { label: "브랜드 대상", value: `${partners.length.toLocaleString()}개`, hint: "신규 제휴/종료 임박 연결" },
            { label: "최근 로그", value: `${recentLogCount.toLocaleString()}건`, hint: "최근 30일 운영 로그" },
            { label: "자동 규칙", value: `${automaticSummaryCount.toLocaleString()}개`, hint: "예약/자동 발송 요약" },
          ]}
          minItemWidth="13rem"
        />
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.72fr)] 2xl:items-start">
          <section className="grid gap-4">
            <SectionHeading
              title="발송 워크스페이스"
              description="로그 확인과 즉시 발송을 같은 작업 영역에서 전환합니다."
            />
            <AdminPushManager
              pushConfigured={isPushConfigured()}
              mattermostConfigured={isMattermostNotificationConfigured()}
              partners={partners}
              members={safeMembers}
              recentLogs={notificationOverview.recentLogs}
              automaticSummaries={notificationOverview.automaticSummaries}
            />
          </section>
          <div className="grid gap-6 2xl:sticky 2xl:top-24">
            <Card tone="elevated" className="grid gap-4">
              <SectionHeading
                title="채널 상태"
                description="발송 전 먼저 확인해야 하는 운영 상태입니다."
              />
              <div className="grid gap-3 rounded-2xl border border-border/70 bg-surface-inset px-4 py-4 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>웹 푸시</span>
                  <span className="font-semibold text-foreground">
                    {isPushConfigured() ? "구성됨" : "미구성"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Mattermost</span>
                  <span className="font-semibold text-foreground">
                    {isMattermostNotificationConfigured() ? "구성됨" : "미구성"}
                  </span>
                </div>
              </div>
            </Card>
            <Card tone="elevated" className="grid gap-3">
              <SectionHeading
                title="운영 메모"
                description="발송 화면을 넓게 쓰되, 보조 지침은 우측에 고정합니다."
              />
              <div className="grid gap-2 text-sm text-muted-foreground">
                <p>대상 범위를 좁힌 뒤 리뷰 단계에서 수신 인원을 확인합니다.</p>
                <p>실패/부분 실패 로그 추적은 알림센터에서 이어서 확인합니다.</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
