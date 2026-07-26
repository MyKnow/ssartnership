import Badge from "@/components/ui/Badge";
import Surface from "@/components/ui/Surface";
import {
  ADMIN_ROUTE_TIMING_MIN_SAMPLE_COUNT,
  type AdminRouteTimingSummaryMetric,
} from "@/lib/admin-performance";

function formatMilliseconds(value: number) {
  return String(Math.round(value).toLocaleString("ko-KR")) + "ms";
}

function getStatus(metric: AdminRouteTimingSummaryMetric) {
  if (metric.status === "met") {
    return { label: "목표 이내", className: "bg-success/15 text-success" };
  }
  if (metric.status === "exceeded") {
    return { label: "목표 초과", className: "bg-danger/15 text-danger" };
  }
  if (metric.status === "insufficient_sample") {
    return { label: "표본 부족", className: "bg-warning/15 text-warning" };
  }
  return {
    label: "표본 없음",
    className: "bg-surface-muted text-muted-foreground",
  };
}

export default function AdminRouteTimingSummaryPanel({
  metrics,
  windowDays,
  loadError,
}: {
  metrics: AdminRouteTimingSummaryMetric[];
  windowDays: number;
  loadError: boolean;
}) {
  return (
    <section
      className="grid min-w-0 gap-4 rounded-panel border border-border/70 bg-surface-elevated p-5 shadow-flat sm:p-6"
      aria-labelledby="admin-route-timing-summary-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="admin-route-timing-summary-title"
            className="text-lg font-semibold text-foreground"
          >
            화면 이동 응답
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            최근 {windowDays}일 관리자 화면 이동의 p75입니다. 표본{" "}
            {ADMIN_ROUTE_TIMING_MIN_SAMPLE_COUNT}건 미만이면 목표 달성으로
            판단하지 않습니다.
          </p>
        </div>
        <Badge variant="neutral">실사용 이동 측정</Badge>
      </div>

      {loadError ? (
        <Surface level="inset" padding="md">
          <p className="text-sm text-muted-foreground">
            화면 이동 집계를 불러오지 못했습니다. 원본 운영 로그는 계속 확인할 수
            있습니다.
          </p>
        </Surface>
      ) : metrics.length === 0 ? (
        <Surface level="inset" padding="md">
          <p className="text-sm text-muted-foreground">
            아직 충분한 화면 이동 측정값이 없습니다. 관리자 화면을 실제로 사용한
            뒤 다시 확인해 주세요.
          </p>
        </Surface>
      ) : (
        <div
          className="min-w-0 overflow-x-auto rounded-card border border-border/70"
          role="region"
          tabIndex={0}
          aria-label="화면별 이동 응답 표. 좌우로 이동할 수 있습니다."
        >
          <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              화면별 이동 응답 시간과 표본, 측정 결과
            </caption>
            <thead className="bg-surface-inset text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  화면
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  p75
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  표본
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  결과
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  상태
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {metrics.map((metric) => {
                const status = getStatus(metric);
                return (
                  <tr key={metric.routeKey}>
                    <th
                      scope="row"
                      className="whitespace-nowrap px-4 py-3 font-semibold text-foreground"
                    >
                      {metric.label}
                    </th>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-foreground">
                      {metric.p75DurationMs === null
                        ? "–"
                        : formatMilliseconds(metric.p75DurationMs)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {metric.sampleCount.toLocaleString("ko-KR")}건
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      완료 {metric.completeCount.toLocaleString("ko-KR")} · 확인 불가{" "}
                      {metric.unknownCount.toLocaleString("ko-KR")} · 오류{" "}
                      {metric.errorCount.toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={status.className}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
