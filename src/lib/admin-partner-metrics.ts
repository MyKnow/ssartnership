import {
  createEmptyPartnerPortalMetrics,
  type PartnerPortalServiceMetrics,
} from "@/lib/partner-dashboard";
import {
  applyPartnerMetricRollupRows,
  PARTNER_METRIC_EVENT_NAMES,
} from "@/lib/partner-metric-rollups";
import { loadPartnerMetricAggregateRows } from "@/lib/partner-metric-loader";
import { listMockPartnerPortalSetupsInternal } from "@/lib/mock/partner-portal/store";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { fetchPartnerEngagementCounts } from "@/lib/partner-counts";

const PARTNER_ADMIN_METRICS_WARNING_MESSAGE =
  "일부 제휴처 집계를 불러오지 못해 최신 수치가 0으로 표시될 수 있습니다.";

export type AdminPartnerMetricsResult = {
  metricsByPartnerId: Map<string, PartnerPortalServiceMetrics>;
  warningMessage?: string | null;
};

function createMetricsMap(partnerIds: string[]) {
  return new Map(
    partnerIds.map((partnerId) => [partnerId, createEmptyPartnerPortalMetrics()]),
  );
}

function getMockMetrics(partnerId: string) {
  const setup = listMockPartnerPortalSetupsInternal().find((candidate) =>
    candidate.company.services.some((service) => service.id === partnerId),
  );
  const service = setup?.company.services.find((candidate) => candidate.id === partnerId);
  return service?.metrics
    ? { ...service.metrics }
    : createEmptyPartnerPortalMetrics();
}

export async function getAdminPartnerMetrics(
  partnerIds: string[],
): Promise<AdminPartnerMetricsResult> {
  const uniquePartnerIds = [...new Set(partnerIds.map((value) => value.trim()).filter(Boolean))];
  if (uniquePartnerIds.length === 0) {
    return {
      metricsByPartnerId: new Map(),
      warningMessage: null,
    };
  }

  if (isPartnerPortalMock) {
    return {
      metricsByPartnerId: new Map(
        uniquePartnerIds.map((partnerId) => [partnerId, getMockMetrics(partnerId)]),
      ),
      warningMessage: null,
    };
  }

  const supabase = getSupabaseAdminClient();
  const metricsByPartnerId = createMetricsMap(uniquePartnerIds);
  let hasPartialFailure = false;

  const [metricRowsResult, engagementCounts] = await Promise.all([
    loadPartnerMetricAggregateRows(supabase, {
      partnerIds: uniquePartnerIds,
      metricNames: PARTNER_METRIC_EVENT_NAMES,
      metricKinds: ["pv", "uv"],
      granularity: "total",
    }),
    fetchPartnerEngagementCounts(
      supabase,
      uniquePartnerIds,
    ),
  ]);

  if (metricRowsResult.failure) {
    hasPartialFailure = true;
    const queryLabel =
      metricRowsResult.failure.stage === "rollup"
        ? "event query failed"
        : "fallback event query failed";
    console.error(
      `[admin-partner-metrics] ${queryLabel}`,
      metricRowsResult.failure.errorMessage,
    );
  } else {
    applyPartnerMetricRollupRows(metricsByPartnerId, metricRowsResult.rows);
  }

  if (engagementCounts.engagementErrorMessage) {
    hasPartialFailure = true;
    console.error("[admin-partner-metrics] engagement query failed", engagementCounts.engagementErrorMessage);
  } else {
    for (const [partnerId, reviewCount] of engagementCounts.reviewCounts) {
      const metrics = metricsByPartnerId.get(partnerId);
      if (!metrics) {
        continue;
      }
      metrics.reviewCount = reviewCount;
    }
  }

  for (const partnerId of uniquePartnerIds) {
    const metrics = metricsByPartnerId.get(partnerId);
    if (!metrics) {
      continue;
    }
    metrics.favoriteCount = engagementCounts.favoriteCounts.get(partnerId) ?? 0;
  }

  return {
    metricsByPartnerId,
    warningMessage: hasPartialFailure ? PARTNER_ADMIN_METRICS_WARNING_MESSAGE : null,
  };
}
