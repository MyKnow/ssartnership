import Badge from "@/components/ui/Badge";
import Surface from "@/components/ui/Surface";
import {
  ADMIN_TASK_OUTCOME_MIN_SAMPLE_COUNT,
  type AdminTaskOutcomeSummaryMetric,
} from "@/lib/admin-task-outcome";

function formatPercentage(value: number | null) {
  return value === null ? "–" : `${value.toFixed(1)}%`;
}

function formatMilliseconds(value: number | null) {
  return value === null
    ? "–"
    : `${Math.round(value).toLocaleString("ko-KR")}ms`;
}

function getStatus(metric: AdminTaskOutcomeSummaryMetric) {
  if (metric.status === "observed") {
    return { label: "관측 가능", className: "bg-success/15 text-success" };
  }
  if (metric.status === "insufficient_sample") {
    return { label: "표본 부족", className: "bg-warning/15 text-warning" };
  }
  return {
    label: "표본 없음",
    className: "bg-surface-muted text-muted-foreground",
  };
}

export default function AdminTaskOutcomeSummaryPanel({
  metrics,
  windowDays,
  loadError,
}: {
  metrics: AdminTaskOutcomeSummaryMetric[];
  windowDays: number;
  loadError: boolean;
}) {
  return (
    <section
      className="grid min-w-0 gap-4 rounded-panel border border-border/70 bg-surface-elevated p-5 shadow-flat sm:p-6"
      aria-labelledby="admin-task-outcome-summary-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="admin-task-outcome-summary-title"
            className="text-lg font-semibold text-foreground"
          >
            관리자 과업 성과
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            최근 {windowDays}일 작업 시작·완료·복구 이벤트를 route별로 집계합니다.
            표본 {ADMIN_TASK_OUTCOME_MIN_SAMPLE_COUNT}건 미만은 관측 중으로 표시합니다.
          </p>
        </div>
        <Badge variant="neutral">과업 계측</Badge>
      </div>

      {loadError ? (
        <Surface level="inset" padding="md">
          <p className="text-sm text-muted-foreground">
            과업 성과 집계를 불러오지 못했습니다. 원본 운영 로그와 작업 화면은 계속
            사용할 수 있습니다.
          </p>
        </Surface>
      ) : metrics.length === 0 ? (
        <Surface level="inset" padding="md">
          <p className="text-sm text-muted-foreground">
            아직 과업 계측 표본이 없습니다. 작업함이나 관리 홈에서 처리 작업을 시작한
            뒤 다시 확인해 주세요.
          </p>
        </Surface>
      ) : (
        <>
          <div
            className="hidden min-w-0 overflow-x-auto rounded-card border border-border/70 md:block"
            role="region"
            tabIndex={0}
            aria-label="관리자 과업 성과 표. 좌우로 이동할 수 있습니다."
          >
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                관리자 과업별 시작 건수, 완료율, 복구율과 처리 시간
              </caption>
              <thead className="bg-surface-inset text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    과업
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    시작
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    완료율
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    복구율
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    처리 p75
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
                    <tr key={metric.taskKey}>
                      <th
                        scope="row"
                        className="whitespace-nowrap px-4 py-3 font-semibold text-foreground"
                      >
                        {metric.label}
                      </th>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {metric.startCount.toLocaleString("ko-KR")}건
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-foreground">
                        {formatPercentage(metric.completionRate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatPercentage(metric.recoveryRate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatMilliseconds(metric.p75DurationMs)}
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

          <div className="grid min-w-0 gap-3 md:hidden" aria-label="관리자 과업 성과 목록">
            {metrics.map((metric) => {
              const status = getStatus(metric);
              return (
                <article
                  key={metric.taskKey}
                  className="grid min-w-0 gap-3 rounded-card border border-border/70 bg-surface-inset p-4"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <h3 className="min-w-0 truncate font-semibold text-foreground">
                      {metric.label}
                    </h3>
                    <Badge className={status.className}>{status.label}</Badge>
                  </div>
                  <div className="grid min-w-0 grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">시작</p>
                      <p className="mt-1 font-semibold text-foreground">
                        {metric.startCount.toLocaleString("ko-KR")}건
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">완료율</p>
                      <p className="mt-1 font-semibold text-foreground">
                        {formatPercentage(metric.completionRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">복구율</p>
                      <p className="mt-1 font-semibold text-foreground">
                        {formatPercentage(metric.recoveryRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">처리 p75</p>
                      <p className="mt-1 font-semibold text-foreground">
                        {formatMilliseconds(metric.p75DurationMs)}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
