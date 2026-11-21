import {
  createEmptyPartnerPortalMetrics,
  type PartnerPortalServiceMetrics,
} from "./partner-dashboard.ts";
import {
  applyPartnerMetricRollupRows,
  PARTNER_METRIC_EVENT_NAMES,
} from "./partner-metric-rollups.ts";
import { loadPartnerMetricAggregateRows } from "./partner-metric-loader.ts";
import { listMockPartnerPortalSetupsInternal } from "./mock/partner-portal/store.ts";
import { isPartnerPortalMock } from "./partner-auth/portal.ts";
import { getSupabaseAdminClient } from "./supabase/server.ts";
import { fetchPartnerEngagementCounts } from "./partner-counts.ts";
import { logServerError } from "./server-log.ts";

const PARTNER_SERVICE_METRICS_WARNING_MESSAGE =
  "일부 제휴처 집계를 불러오지 못해 최신 수치가 0으로 표시될 수 있습니다.";

export type PartnerServiceMetricsSnapshot = {
  metrics: PartnerPortalServiceMetrics;
  warningMessage?: string | null;
};

export const createEmptyPartnerServiceMetrics = createEmptyPartnerPortalMetrics;

function getMockPartnerServiceMetrics(partnerId: string): PartnerServiceMetricsSnapshot {
  const setup = listMockPartnerPortalSetupsInternal().find((candidate) =>
    candidate.company.services.some((service) => service.id === partnerId),
  );
  const service = setup?.company.services.find((candidate) => candidate.id === partnerId);

  return {
    metrics: service?.metrics
      ? { ...service.metrics }
      : createEmptyPartnerServiceMetrics(),
    warningMessage: null,
  };
}

export async function getPartnerServiceMetrics(
  partnerId: string,
): Promise<PartnerServiceMetricsSnapshot> {
  if (isPartnerPortalMock) {
    return getMockPartnerServiceMetrics(partnerId);
  }

  const supabase = getSupabaseAdminClient();
  let hasPartialFailure = false;
  const markPartialFailure = () => {
    hasPartialFailure = true;
  };
  const metrics = createEmptyPartnerServiceMetrics();
  const [metricRowsResult, engagementCounts] = await Promise.all([
    loadPartnerMetricAggregateRows(supabase, {
      partnerIds: [partnerId],
      metricNames: PARTNER_METRIC_EVENT_NAMES,
      metricKinds: ["pv", "uv"],
      granularity: "total",
    }),
    fetchPartnerEngagementCounts(
      supabase,
      [partnerId],
    ),
  ]);

  if (metricRowsResult.failure) {
    markPartialFailure();
    const queryLabel =
      metricRowsResult.failure.stage === "rollup"
        ? "event query failed"
        : "fallback event query failed";
    logServerError(`[partner-service-metrics] ${queryLabel}`, metricRowsResult.failure.errorMessage, { partnerId });
  } else {
    const metricsByPartnerId = new Map([[partnerId, metrics]]);
    applyPartnerMetricRollupRows(metricsByPartnerId, metricRowsResult.rows);
  }

  if (engagementCounts.engagementErrorMessage) {
    markPartialFailure();
    logServerError("[partner-service-metrics] engagement query failed", engagementCounts.engagementErrorMessage, { partnerId });
  }

  metrics.reviewCount = engagementCounts.reviewCounts.get(partnerId) ?? 0;
  metrics.favoriteCount = engagementCounts.favoriteCounts.get(partnerId) ?? 0;

  return {
    metrics,
    warningMessage: hasPartialFailure ? PARTNER_SERVICE_METRICS_WARNING_MESSAGE : null,
  };
}
