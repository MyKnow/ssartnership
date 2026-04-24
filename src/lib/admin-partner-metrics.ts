import type { PartnerPortalServiceMetrics } from "@/lib/partner-dashboard";
import { createEmptyPartnerServiceMetrics } from "@/lib/partner-service-metrics";
import {
  applyPartnerMetricRollupRows,
  buildPartnerMetricRollupRowsFromEventLogs,
  fetchPartnerMetricRollupRows,
  fetchPartnerMetricEventLogRows,
  PARTNER_METRIC_EVENT_NAMES,
} from "@/lib/partner-metric-rollups";
import { listMockPartnerPortalSetupsInternal } from "@/lib/mock/partner-portal/store";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import { partnerFavoriteRepository } from "@/lib/repositories";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const PARTNER_ADMIN_METRICS_WARNING_MESSAGE =
  "일부 브랜드 집계를 불러오지 못해 최신 수치가 0으로 표시될 수 있습니다.";

export type AdminPartnerMetricsResult = {
  metricsByPartnerId: Map<string, PartnerPortalServiceMetrics>;
  warningMessage?: string | null;
};

function createMetricsMap(partnerIds: string[]) {
  return new Map(
    partnerIds.map((partnerId) => [partnerId, createEmptyPartnerServiceMetrics()]),
  );
}

function countRowsByPartnerId(rows: Array<{ partner_id?: string | null }>, partnerIds: string[]) {
  const counts = new Map(partnerIds.map((partnerId) => [partnerId, 0]));
  for (const row of rows) {
    const partnerId = row.partner_id ?? "";
    if (!counts.has(partnerId)) {
      continue;
    }
    counts.set(partnerId, (counts.get(partnerId) ?? 0) + 1);
  }
  return counts;
}

function indexMetricEventRowsByTargetId<T extends { target_id: string | null }>(rows: T[]) {
  const rowsByTargetId = new Map<string, typeof rows>();
  for (const row of rows) {
    const targetId = row.target_id ?? "";
    if (!targetId) {
      continue;
    }
    const bucket = rowsByTargetId.get(targetId);
    if (bucket) {
      bucket.push(row);
      continue;
    }
    rowsByTargetId.set(targetId, [row]);
  }
  return rowsByTargetId;
}

function getMockMetrics(partnerId: string) {
  const setup = listMockPartnerPortalSetupsInternal().find((candidate) =>
    candidate.company.services.some((service) => service.id === partnerId),
  );
  const service = setup?.company.services.find((candidate) => candidate.id === partnerId);
  return service?.metrics
    ? { ...service.metrics }
    : createEmptyPartnerServiceMetrics();
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

  const [eventResult, reviewResult] = await Promise.all([
    fetchPartnerMetricRollupRows(supabase, {
      partnerIds: uniquePartnerIds,
      metricNames: PARTNER_METRIC_EVENT_NAMES,
      metricKinds: ["pv", "uv"],
      granularity: "total",
    }),
    supabase
      .from("partner_reviews")
      .select("partner_id")
      .in("partner_id", uniquePartnerIds)
      .is("deleted_at", null),
  ]);
  let favoriteCounts = new Map<string, number>();

  try {
    favoriteCounts = await partnerFavoriteRepository.getFavoriteCounts(
      uniquePartnerIds,
    );
  } catch (error) {
    hasPartialFailure = true;
    console.error("[admin-partner-metrics] favorite query failed", error);
  }

  if (eventResult.errorMessage) {
    hasPartialFailure = true;
    console.error("[admin-partner-metrics] event query failed", eventResult.errorMessage);
  } else {
    if (eventResult.rows.length > 0) {
      applyPartnerMetricRollupRows(metricsByPartnerId, eventResult.rows);
    } else {
      const fallbackResult = await fetchPartnerMetricEventLogRows(supabase, uniquePartnerIds);
      if (fallbackResult.errorMessage) {
        hasPartialFailure = true;
        console.error(
          "[admin-partner-metrics] fallback event query failed",
          fallbackResult.errorMessage,
        );
      } else {
        const rowsByTargetId = indexMetricEventRowsByTargetId(fallbackResult.rows);
        for (const partnerId of uniquePartnerIds) {
          applyPartnerMetricRollupRows(
            metricsByPartnerId,
            buildPartnerMetricRollupRowsFromEventLogs(
              rowsByTargetId.get(partnerId) ?? [],
              partnerId,
            ),
          );
        }
      }
    }
  }

  if (reviewResult.error) {
    hasPartialFailure = true;
    console.error("[admin-partner-metrics] review query failed", reviewResult.error.message);
  } else {
    const reviewCounts = countRowsByPartnerId(reviewResult.data ?? [], uniquePartnerIds);
    for (const [partnerId, reviewCount] of reviewCounts) {
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
    metrics.favoriteCount = favoriteCounts.get(partnerId) ?? 0;
  }

  return {
    metricsByPartnerId,
    warningMessage: hasPartialFailure ? PARTNER_ADMIN_METRICS_WARNING_MESSAGE : null,
  };
}
