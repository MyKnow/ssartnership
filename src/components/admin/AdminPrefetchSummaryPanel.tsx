import Badge from "@/components/ui/Badge";
import Surface from "@/components/ui/Surface";
import {
  ADMIN_PREFETCH_MIN_SAMPLE_COUNT,
  type AdminPrefetchSummaryMetric,
} from "@/lib/admin-performance";

function formatPercent(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}%`;
}

function getStatus(metric: AdminPrefetchSummaryMetric) {
  if (metric.status === "met") {
    return { label: "목표 이내", className: "bg-success/15 text-success" };
  }
  if (metric.status === "exceeded") {
    return { label: "목표 미달", className: "bg-danger/15 text-danger" };
  }
  if (metric.status === "insufficient_sample") {
    return { label: "표본 부족", className: "bg-warning/15 text-warning" };
  }
  return { label: "표본 없음", className: "bg-surface-muted text-muted-foreground" };
}

export default function AdminPrefetchSummaryPanel({
  metrics,
  windowDays,
  loadError,
}: {
  metrics: AdminPrefetchSummaryMetric[];
  windowDays: number;
  loadError: boolean;
}) {
  return (
    <section
      className="grid min-w-0 gap-4 rounded-panel border border-border/70 bg-surface-elevated p-5 shadow-flat sm:p-6"
      aria-labelledby="admin-prefetch-summary-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="admin-prefetch-summary-title" className="text-lg font-semibold text-foreground">
            다음 화면 준비율
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            최근 {windowDays}일 동안 의도 신호 뒤 실제 이동으로 이어진 비율입니다. Next.js 내부 캐시 적중률이 아닌 운영 가능한 활용률이며, 표본 {ADMIN_PREFETCH_MIN_SAMPLE_COUNT}건 미만은 판단하지 않습니다.
          </p>
        </div>
        <Badge variant="neutral">prefetch 활용률</Badge>
      </div>

      {loadError ? (
        <Surface level="inset" padding="md">
          <p className="text-sm text-muted-foreground">
            다음 화면 준비율을 불러오지 못했습니다. 원본 운영 로그는 계속 확인할 수 있습니다.
          </p>
        </Surface>
      ) : metrics.length === 0 ? (
        <Surface level="inset" padding="md">
          <p className="text-sm text-muted-foreground">
            아직 prefetch 활용 측정값이 없습니다. 관리자 화면을 실제로 사용한 뒤 다시 확인해 주세요.
          </p>
        </Surface>
      ) : (
        <div
          className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3"
          aria-label="화면별 prefetch 활용률 목록"
        >
          {metrics.map((metric) => {
            const status = getStatus(metric);
            return (
              <Surface key={metric.routeKey} level="inset" padding="md">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <h3 className="min-w-0 truncate font-semibold text-foreground">
                    {metric.label}
                  </h3>
                  <Badge className={status.className}>{status.label}</Badge>
                </div>
                <p className="mt-4 text-2xl font-semibold text-foreground">
                  {metric.utilizationRate === null
                    ? "–"
                    : formatPercent(metric.utilizationRate)}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  실제 이동 {metric.usedCount.toLocaleString("ko-KR")}건 · 요청 {metric.sampleCount.toLocaleString("ko-KR")}건 · 목표 {formatPercent(metric.threshold)}
                </p>
              </Surface>
            );
          })}
        </div>
      )}
    </section>
  );
}
