import { Suspense } from "react";
import AdminLogsManager from "@/components/admin/AdminLogsManager";
import AdminLogsAncillaryPanels, {
  AdminLogsAncillaryFallback,
} from "@/components/admin/AdminLogsAncillaryPanels";
import AdminShell from "@/components/admin/AdminShell";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { requireAdminPermission } from "@/lib/admin-access";
import { getAdminLogAccessPolicy } from "@/lib/admin-log-access";
import { getAdminLogsPageData } from "@/lib/log-insights";
import { fetchForwardActivityMetrics } from "@/lib/platform-activity-forward-metrics";
import { getAdminWebVitalSummary } from "@/lib/admin-web-vitals-summary.server";
import { getAdminRouteTimingSummary } from "@/lib/admin-route-timing-summary.server";
import { getAdminTaskOutcomeSummary } from "@/lib/admin-task-outcome-summary.server";
import { AdminLogsSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import type { GetAdminLogsPageDataOptions } from "@/lib/log-insights";

export const dynamic = "force-dynamic";

async function AdminLogsContent({
  session,
  initialQuery,
}: {
  session: Awaited<ReturnType<typeof requireAdminPermission>>;
  initialQuery: GetAdminLogsPageDataOptions;
}) {
  const access = getAdminLogAccessPolicy(session.account);
  const activityPromise = fetchForwardActivityMetrics();
  const webVitalsPromise = getAdminWebVitalSummary();
  const routeTimingPromise = getAdminRouteTimingSummary();
  const taskOutcomePromise = getAdminTaskOutcomeSummary();
  const data = await getAdminLogsPageData(initialQuery, access);

  return (
    <div className="grid gap-6">
        <AdminPageHeader
          eyebrow="리포트"
          title="운영 로그 조회"
          description="제품 이벤트, 관리자 감사, 인증 보안 로그를 공통 탐색 규칙으로 확인합니다."
        />
        <AdminLogsManager initialData={data} initialQuery={initialQuery} />
        <Suspense fallback={<AdminLogsAncillaryFallback />}>
          <AdminLogsAncillaryPanels
            activity={activityPromise}
            webVitals={webVitalsPromise}
            routeTiming={routeTimingPromise}
            taskOutcome={taskOutcomePromise}
          />
        </Suspense>
    </div>
  );
}

type AdminLogsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function getFirstSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function toAdminLogsQuery(
  params: Record<string, string | string[] | undefined>,
): GetAdminLogsPageDataOptions {
  return {
    preset: getFirstSearchParam(params, "preset"),
    start: getFirstSearchParam(params, "start"),
    end: getFirstSearchParam(params, "end"),
    page: getFirstSearchParam(params, "page"),
    pageSize: getFirstSearchParam(params, "pageSize"),
    search: getFirstSearchParam(params, "search"),
    group: getFirstSearchParam(params, "group"),
    name: getFirstSearchParam(params, "name"),
    actor: getFirstSearchParam(params, "actor"),
    status: getFirstSearchParam(params, "status"),
    sort: getFirstSearchParam(params, "sort"),
    cursor: getFirstSearchParam(params, "cursor"),
  };
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams?: AdminLogsSearchParams;
}) {
  const session = await requireAdminPermission("logs", "read", {
    path: "/admin/logs",
  });
  const initialQuery = toAdminLogsQuery((await searchParams) ?? {});

  return (
    <AdminShell title="로그 조회" backHref="/admin" backLabel="관리 홈">
      <Suspense fallback={<AdminLogsSkeletonContent />}>
        <AdminLogsContent session={session} initialQuery={initialQuery} />
      </Suspense>
    </AdminShell>
  );
}
