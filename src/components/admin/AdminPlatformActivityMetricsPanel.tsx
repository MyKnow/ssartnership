import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import Badge from "@/components/ui/Badge";
import Surface from "@/components/ui/Surface";
import type { AdminPlatformActivityMetrics } from "@/lib/platform-activity-metrics";

type ActivityMetricCard = {
  label: string;
  value: number;
  description: string;
};

function formatDate(value: string | null) {
  if (!value) {
    return "집계 대기";
  }
  return value.replaceAll("-", ".");
}

export default function AdminPlatformActivityMetricsPanel({
  metrics,
}: {
  metrics: AdminPlatformActivityMetrics;
}) {
  const memberMetrics: ActivityMetricCard[] = [
    { label: "DAU", value: metrics.memberDau, description: "오늘 활성 회원" },
    { label: "WAU", value: metrics.memberWau, description: "최근 7일 활성 회원" },
    { label: "MAU", value: metrics.memberMau, description: "최근 30일 활성 회원" },
  ];
  const peakMemberActiveCount = Math.max(
    1,
    ...metrics.dailySeries.map((point) => point.memberActiveCount),
  );

  return (
    <section className="grid min-w-0 gap-4" aria-label="서비스 활성도">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <AdminSectionHeading
          title="서비스 활성도"
          description="로그인 회원 기준 DAU·WAU·MAU입니다. 비로그인 방문은 별도 세션으로 집계합니다."
        />
        <Badge variant="neutral">기준일 {formatDate(metrics.asOfDate)}</Badge>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {memberMetrics.map((item) => (
          <Surface key={item.label} level="inset" padding="md" className="min-w-0">
            <p className="ui-kicker">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
              {item.value.toLocaleString("ko-KR")}명
            </p>
            <p className="mt-1 truncate text-sm text-muted-foreground">{item.description}</p>
          </Surface>
        ))}
        <Surface level="inset" padding="md" className="min-w-0">
          <p className="ui-kicker">방문 세션</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
            {metrics.guestSessionMau.toLocaleString("ko-KR")}회
          </p>
          <p className="mt-1 truncate text-sm text-muted-foreground">최근 30일 비로그인 방문</p>
        </Surface>
      </div>

      <Surface level="inset" padding="md" className="grid min-w-0 gap-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">최근 30일 회원 활성 추이</p>
            <p className="mt-1 text-sm text-muted-foreground">
              로그 보관 시작일 {formatDate(metrics.historyStartDate)}
            </p>
          </div>
          <Badge variant="neutral">
            오늘 방문 세션 {metrics.guestSessionDau.toLocaleString("ko-KR")}회
          </Badge>
        </div>

        {metrics.dailySeries.length > 0 ? (
          <ol
            className="grid min-w-0 grid-cols-10 items-end gap-1.5 xl:grid-cols-[repeat(15,minmax(0,1fr))]"
            aria-label="최근 30일 로그인 회원 활성 추이"
          >
            {metrics.dailySeries.map((point) => {
              const percent = Math.max(
                8,
                Math.round((point.memberActiveCount / peakMemberActiveCount) * 100),
              );
              return (
                <li
                  key={point.date}
                  className="group relative flex h-20 min-w-0 items-end rounded-lg bg-surface-muted px-1 pb-1"
                  title={`${point.date}: 로그인 회원 ${point.memberActiveCount.toLocaleString("ko-KR")}명, 비로그인 방문 ${point.guestSessionCount.toLocaleString("ko-KR")}회`}
                >
                  <span
                    className="w-full rounded-md bg-primary transition-colors group-hover:bg-primary/80"
                    style={{ height: `${percent}%` }}
                  />
                  <span className="sr-only">
                    {point.date} 로그인 회원 {point.memberActiveCount.toLocaleString("ko-KR")}명,
                    비로그인 방문 {point.guestSessionCount.toLocaleString("ko-KR")}회
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">활성 추이를 집계하고 있습니다.</p>
        )}
      </Surface>
    </section>
  );
}
