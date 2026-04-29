import AdminNotificationCenter from "@/components/admin/notification-center/AdminNotificationCenter";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
import { getAdminNotificationOverview } from "@/lib/admin-notification-ops";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const { recentLogs, automaticSummaries } = await getAdminNotificationOverview(100, 30);
  const sentCount = recentLogs.filter((log) => log.status === "sent").length;
  const failedCount = recentLogs.filter(
    (log) => log.status === "failed" || log.status === "partial_failed",
  ).length;
  const pendingCount = recentLogs.filter(
    (log) => log.status === "pending" || log.status === "no_target",
  ).length;

  return (
    <AdminShell title="알림센터" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Notifications"
          title="알림센터"
          description="발송 결과와 실패, 예약/즉시 발송, 대상자 요약을 조회합니다."
        />
        <StatsRow
          items={[
            { label: "완료", value: `${sentCount.toLocaleString()}건`, hint: "최근 조회 범위 기준" },
            { label: "실패", value: `${failedCount.toLocaleString()}건`, hint: "실패/부분 실패" },
            { label: "대기", value: `${pendingCount.toLocaleString()}건`, hint: "예약/대상 없음 포함" },
            { label: "자동 규칙", value: `${automaticSummaries.length.toLocaleString()}개`, hint: "자동 발송 집계" },
          ]}
          minItemWidth="13rem"
        />
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.72fr)] 2xl:items-start">
          <section className="grid gap-4">
            <SectionHeading
              title="발송 모니터링"
              description="상태, 대상, 발송 종류 기준으로 운영 로그를 추적합니다."
            />
            <AdminNotificationCenter
              recentLogs={recentLogs}
              automaticSummaries={automaticSummaries}
            />
          </section>
          <Card tone="elevated" className="grid gap-3 2xl:sticky 2xl:top-24">
            <SectionHeading
              title="확인 포인트"
              description="운영 화면을 넓게 쓰고, 보조 설명은 별도 패널로 분리합니다."
            />
            <div className="grid gap-2 text-sm text-muted-foreground">
              <p>실패 로그는 재시도 전 대상 범위와 채널 상태를 함께 확인합니다.</p>
              <p>즉시 발송과 자동 발송은 같은 필터 규칙으로 비교할 수 있습니다.</p>
            </div>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
