import Badge from "@/components/ui/Badge";
import Surface from "@/components/ui/Surface";
import type { AdminWebVitalSummaryMetric } from "@/lib/admin-performance";

function formatMilliseconds(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}ms`;
}

function getStatus(metric: AdminWebVitalSummaryMetric) {
  if (metric.status === "met") {
    return { label: "목표 이내", className: "bg-success/15 text-success" };
  }
  if (metric.status === "exceeded") {
    return { label: "목표 초과", className: "bg-danger/15 text-danger" };
  }
  return { label: "표본 없음", className: "bg-surface-muted text-muted-foreground" };
}

export default function AdminWebVitalSummaryPanel({
  metrics,
  windowDays,
  loadError,
}: {
  metrics: AdminWebVitalSummaryMetric[];
  windowDays: number;
  loadError: boolean;
}) {
  return (
    <section
      className="grid min-w-0 gap-4 rounded-panel border border-border/70 bg-surface-elevated p-5 shadow-flat sm:p-6"
      aria-labelledby="admin-web-vital-summary-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="admin-web-vital-summary-title" className="text-lg font-semibold text-foreground">
            관리자 체감 성능
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            최근 {windowDays}일 실제 관리자 방문의 p75입니다. 표본이 없으면 목표 달성으로 판단하지 않습니다.
          </p>
        </div>
        <Badge variant="neutral">실사용 RUM</Badge>
      </div>

      {loadError ? (
        <Surface level="inset" padding="md">
          <p className="text-sm text-muted-foreground">
            성능 집계를 불러오지 못했습니다. 원본 운영 로그는 계속 확인할 수 있습니다.
          </p>
        </Surface>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {metrics.map((metric) => {
            const status = getStatus(metric);
            return (
              <Surface key={metric.metric} level="inset" padding="md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="ui-kicker">{metric.metric}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{metric.label}</p>
                  </div>
                  <Badge className={status.className}>{status.label}</Badge>
                </div>
                <p className="mt-4 text-2xl font-semibold text-foreground">
                  {metric.p75Value === null ? "–" : formatMilliseconds(metric.p75Value)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  목표 {formatMilliseconds(metric.threshold)} · 표본 {metric.sampleCount.toLocaleString("ko-KR")}건
                </p>
              </Surface>
            );
          })}
        </div>
      )}
    </section>
  );
}
