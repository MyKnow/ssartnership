import type { PartnerPortalServiceMetrics } from "./partner-dashboard.ts";
import {
  applyPartnerMetricRollupRows,
  buildPartnerMetricRollupRowsFromEventLogs,
  fetchPartnerMetricRollupRows,
  fetchPartnerMetricEventLogRows,
  PARTNER_METRIC_EVENT_NAMES,
} from "./partner-metric-rollups.ts";
import { listMockPartnerPortalSetupsInternal } from "./mock/partner-portal/store.ts";
import { isPartnerPortalMock } from "./partner-portal.ts";
import { partnerFavoriteRepository } from "./repositories/index.ts";
import { getSupabaseAdminClient } from "./supabase/server.ts";

const PARTNER_SERVICE_METRICS_WARNING_MESSAGE =
  "일부 브랜드 집계를 불러오지 못해 최신 수치가 0으로 표시될 수 있습니다.";

export type PartnerServiceMetricsSnapshot = {
  metrics: PartnerPortalServiceMetrics;
  warningMessage?: string | null;
};

export function createEmptyPartnerServiceMetrics(): PartnerPortalServiceMetrics {
  return {
    favoriteCount: 0,
    detailViews: 0,
    detailUv: 0,
    cardClicks: 0,
    mapClicks: 0,
    reservationClicks: 0,
    inquiryClicks: 0,
    reviewCount: 0,
    totalClicks: 0,
  };
}

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
  let favoriteCount = 0;

  const [rollupResult, reviewResult] = await Promise.all([
    fetchPartnerMetricRollupRows(supabase, {
      partnerIds: [partnerId],
      metricNames: PARTNER_METRIC_EVENT_NAMES,
      metricKinds: ["pv", "uv"],
      granularity: "total",
    }),
    (async () => {
      const { count, error } = await supabase
        .from("partner_reviews")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", partnerId)
        .is("deleted_at", null);

      if (error) {
        markPartialFailure();
        console.error("[partner-service-metrics] review query failed", {
          partnerId,
          message: error.message,
        });
        return 0;
      }

      return count ?? 0;
    })(),
  ]);

  try {
    const favoriteCounts = await partnerFavoriteRepository.getFavoriteCounts([
      partnerId,
    ]);
    favoriteCount = favoriteCounts.get(partnerId) ?? 0;
  } catch (error) {
    markPartialFailure();
    console.error("[partner-service-metrics] favorite query failed", {
      partnerId,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (rollupResult.errorMessage) {
    markPartialFailure();
    console.error("[partner-service-metrics] event query failed", {
      partnerId,
      message: rollupResult.errorMessage,
    });
  } else {
    const metricsByPartnerId = new Map([[partnerId, metrics]]);
    if (rollupResult.rows.length > 0) {
      applyPartnerMetricRollupRows(metricsByPartnerId, rollupResult.rows);
    } else {
      const fallbackResult = await fetchPartnerMetricEventLogRows(supabase, [partnerId]);
      if (fallbackResult.errorMessage) {
        markPartialFailure();
        console.error("[partner-service-metrics] fallback event query failed", {
          partnerId,
          message: fallbackResult.errorMessage,
        });
      } else {
        applyPartnerMetricRollupRows(
          metricsByPartnerId,
          buildPartnerMetricRollupRowsFromEventLogs(fallbackResult.rows, partnerId),
        );
      }
    }
  }

  metrics.reviewCount = reviewResult;
  metrics.favoriteCount = favoriteCount;

  return {
    metrics,
    warningMessage: hasPartialFailure ? PARTNER_SERVICE_METRICS_WARNING_MESSAGE : null,
  };
}
