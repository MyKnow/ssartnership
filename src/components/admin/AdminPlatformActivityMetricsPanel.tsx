import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import Badge from "@/components/ui/Badge";
import Surface from "@/components/ui/Surface";
import {
  buildActivityHeatmap,
  type ActivityHeatmapCell,
} from "@/lib/platform-activity-heatmap";
import type { AdminPlatformActivityMetrics } from "@/lib/platform-activity-metrics";

type ActivityMetricCard = {
  label: string;
  value: number;
  description: string;
};

const ACTIVITY_INTENSITY_CLASSES = [
  "bg-surface-muted",
  "bg-primary/20",
  "bg-primary/35",
  "bg-primary/50",
  "bg-primary/70",
] as const;

const WEEKDAY_LABELS = ["", "월", "", "수", "", "금", ""] as const;

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
  const activityHeatmap = buildActivityHeatmap(metrics.dailySeries);
  const activeDays = metrics.dailySeries.filter((point) => point.memberActiveCount > 0).length;

  function renderActivityCell(cell: ActivityHeatmapCell) {
    if (!cell.date) {
      return <span key="empty" aria-hidden="true" className="block size-3 sm:size-4 xl:size-5" />;
    }

    return (
      <span
        key={cell.date}
        role="img"
        aria-label={`${cell.date} 로그인 회원 ${cell.memberActiveCount.toLocaleString("ko-KR")}명, 비로그인 방문 ${cell.guestSessionCount.toLocaleString("ko-KR")}회`}
        title={`${cell.date}: 로그인 회원 ${cell.memberActiveCount.toLocaleString("ko-KR")}명 · 비로그인 방문 ${cell.guestSessionCount.toLocaleString("ko-KR")}회`}
        className={`block size-3 rounded-[3px] ring-1 ring-inset ring-border/60 transition-[filter] hover:brightness-90 sm:size-4 xl:size-5 ${ACTIVITY_INTENSITY_CLASSES[cell.intensity]}`}
      />
    );
  }

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
            <p className="font-semibold text-foreground">최근 12주 회원 활동</p>
            <p className="mt-1 text-sm text-muted-foreground">
              로그 보관 시작일 {formatDate(metrics.historyStartDate)} · 활동일 {activeDays}일
            </p>
          </div>
          <Badge variant="neutral">
            오늘 방문 세션 {metrics.guestSessionDau.toLocaleString("ko-KR")}회
          </Badge>
        </div>

        {activityHeatmap.length > 0 ? (
          <div className="grid min-w-0 gap-3" role="group" aria-label="최근 12주 로그인 회원 활동 잔디">
            <div className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
              <span aria-hidden="true" />
              <div className="grid grid-flow-col grid-rows-1 auto-cols-max gap-1 text-[10px] leading-4 text-muted-foreground sm:gap-1.5 xl:gap-2">
                {activityHeatmap.map((week) => (
                  <span key={week.key} className="w-3 text-center sm:w-4 xl:w-5">
                    {week.monthLabel}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
              <div className="grid grid-rows-7 gap-1 text-[10px] leading-4 text-muted-foreground sm:gap-1.5 xl:gap-2">
                {WEEKDAY_LABELS.map((label, index) => (
                  <span key={`${label}-${index}`} className="flex h-3 items-center sm:h-4 xl:h-5">
                    {label}
                  </span>
                ))}
              </div>
              <div
                className="grid min-w-0 grid-flow-col grid-rows-7 auto-cols-max gap-1 sm:gap-1.5 xl:gap-2"
                role="list"
                aria-label="최근 12주 로그인 회원 활동 일별 목록"
              >
                {activityHeatmap.flatMap((week) => week.cells).map((cell, index) => (
                  <span key={cell.date ?? `empty-${index}`} role={cell.date ? "listitem" : undefined}>
                    {renderActivityCell(cell)}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>회원 활동이 많을수록 진하게 표시됩니다.</span>
              <div className="flex items-center gap-1.5" aria-label="활동량 범례">
                <span>적음</span>
                {ACTIVITY_INTENSITY_CLASSES.map((className, index) => (
                  <span
                    key={className}
                    role="img"
                    aria-label={index === 0 ? "활동 없음" : `활동량 ${index}단계`}
                    className={`size-3 rounded-[3px] ring-1 ring-inset ring-border/60 ${className}`}
                  />
                ))}
                <span>많음</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">활성 추이를 집계하고 있습니다.</p>
        )}
      </Surface>
    </section>
  );
}
