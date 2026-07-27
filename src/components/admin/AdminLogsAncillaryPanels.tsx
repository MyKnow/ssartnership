import AdminWebVitalSummaryPanel from "@/components/admin/AdminWebVitalSummaryPanel";
import AdminRouteTimingSummaryPanel from "@/components/admin/AdminRouteTimingSummaryPanel";
import AdminTaskOutcomeSummaryPanel from "@/components/admin/AdminTaskOutcomeSummaryPanel";
import AdminForwardActivityPanel from "@/components/admin/logs/AdminForwardActivityPanel";
import InlineMessage from "@/components/ui/InlineMessage";
import Skeleton from "@/components/ui/Skeleton";
import Surface from "@/components/ui/Surface";
import {
  emptyForwardActivityMetrics,
  type ForwardActivityMetrics,
} from "@/lib/platform-activity-forward-metrics";
import type { AdminWebVitalSummaryMetric } from "@/lib/admin-performance";
import type { AdminRouteTimingSummaryMetric } from "@/lib/admin-performance";
import type { AdminTaskOutcomeSummaryMetric } from "@/lib/admin-task-outcome";

type ActivityLoadResult = {
  metrics: ForwardActivityMetrics;
  errorMessage?: string | null;
};

type WebVitalLoadResult = {
  metrics: AdminWebVitalSummaryMetric[];
  windowDays: number;
  loadError: boolean;
};

type RouteTimingLoadResult = {
  metrics: AdminRouteTimingSummaryMetric[];
  windowDays: number;
  loadError: boolean;
};

type TaskOutcomeLoadResult = {
  metrics: AdminTaskOutcomeSummaryMetric[];
  windowDays: number;
  loadError: boolean;
};

export function AdminLogsAncillaryFallback() {
  return (
    <Surface
      level="elevated"
      padding="lg"
      role="status"
      aria-busy="true"
      aria-label="운영 보조 지표를 불러오는 중"
      className="grid gap-3"
    >
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </Surface>
  );
}

async function resolveActivity(promise: Promise<ActivityLoadResult>) {
  try {
    const result = await promise;
    return {
      metrics: result.metrics,
      hasError: Boolean(result.errorMessage),
    };
  } catch {
    return {
      metrics: emptyForwardActivityMetrics(),
      hasError: true,
    };
  }
}

async function resolveWebVitals(
  promise: Promise<WebVitalLoadResult>,
): Promise<WebVitalLoadResult> {
  try {
    return await promise;
  } catch {
    return {
      metrics: [],
      windowDays: 7,
      loadError: true,
    };
  }
}

async function resolveRouteTiming(
  promise: Promise<RouteTimingLoadResult>,
): Promise<RouteTimingLoadResult> {
  try {
    return await promise;
  } catch {
    return {
      metrics: [],
      windowDays: 7,
      loadError: true,
    };
  }
}

async function resolveTaskOutcome(
  promise: Promise<TaskOutcomeLoadResult>,
): Promise<TaskOutcomeLoadResult> {
  try {
    return await promise;
  } catch {
    return {
      metrics: [],
      windowDays: 7,
      loadError: true,
    };
  }
}

export default async function AdminLogsAncillaryPanels({
  activity,
  webVitals,
  routeTiming,
  taskOutcome,
}: {
  activity: Promise<ActivityLoadResult>;
  webVitals: Promise<WebVitalLoadResult>;
  routeTiming: Promise<RouteTimingLoadResult>;
  taskOutcome: Promise<TaskOutcomeLoadResult>;
}) {
  const [
    activityResult,
    webVitalResult,
    routeTimingResult,
    taskOutcomeResult,
  ] = await Promise.all([
    resolveActivity(activity),
    resolveWebVitals(webVitals),
    resolveRouteTiming(routeTiming),
    resolveTaskOutcome(taskOutcome),
  ]);

  return (
    <>
      <AdminForwardActivityPanel metrics={activityResult.metrics} />
      {activityResult.hasError ? (
        <InlineMessage
          tone="warning"
          title="회원 활성도 집계를 불러오지 못했습니다."
          description="로그 탐색은 계속 사용할 수 있습니다. 잠시 후 다시 확인해 주세요."
        />
      ) : null}
      <AdminWebVitalSummaryPanel {...webVitalResult} />
      <AdminRouteTimingSummaryPanel {...routeTimingResult} />
      <AdminTaskOutcomeSummaryPanel {...taskOutcomeResult} />
    </>
  );
}
