import type { PartnerPortalServiceMetrics } from "@/lib/partner-dashboard";
import { createEmptyPartnerServiceMetrics } from "@/lib/partner-service-metrics";
import { listMockPartnerPortalSetupsInternal } from "@/lib/mock/partner-portal/store";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const PARTNER_ADMIN_METRICS_WARNING_MESSAGE =
  "일부 브랜드 집계를 불러오지 못해 최신 수치가 0으로 표시될 수 있습니다.";

type PartnerEventName =
  | "partner_detail_view"
  | "partner_card_click"
  | "partner_map_click"
  | "reservation_click"
  | "inquiry_click";

const TRACKED_EVENT_NAMES: PartnerEventName[] = [
  "partner_detail_view",
  "partner_card_click",
  "partner_map_click",
  "reservation_click",
  "inquiry_click",
];

export type AdminPartnerMetricsResult = {
  metricsByPartnerId: Map<string, PartnerPortalServiceMetrics>;
  warningMessage?: string | null;
};

function createMetricsMap(partnerIds: string[]) {
  return new Map(
    partnerIds.map((partnerId) => [partnerId, createEmptyPartnerServiceMetrics()]),
  );
}

function applyEventCount(
  metrics: PartnerPortalServiceMetrics,
  eventName: PartnerEventName,
) {
  switch (eventName) {
    case "partner_detail_view":
      metrics.detailViews += 1;
      break;
    case "partner_card_click":
      metrics.cardClicks += 1;
      break;
    case "partner_map_click":
      metrics.mapClicks += 1;
      break;
    case "reservation_click":
      metrics.reservationClicks += 1;
      break;
    case "inquiry_click":
      metrics.inquiryClicks += 1;
      break;
  }

  metrics.totalClicks =
    metrics.cardClicks +
    metrics.mapClicks +
    metrics.reservationClicks +
    metrics.inquiryClicks;
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
    supabase
      .from("event_logs")
      .select("target_id,event_name")
      .eq("target_type", "partner")
      .in("target_id", uniquePartnerIds)
      .in("event_name", TRACKED_EVENT_NAMES),
    supabase
      .from("partner_reviews")
      .select("partner_id")
      .in("partner_id", uniquePartnerIds)
      .is("deleted_at", null),
  ]);

  if (eventResult.error) {
    hasPartialFailure = true;
    console.error("[admin-partner-metrics] event query failed", eventResult.error.message);
  } else {
    for (const row of eventResult.data ?? []) {
      const metrics = metricsByPartnerId.get(row.target_id ?? "");
      if (!metrics) {
        continue;
      }
      applyEventCount(metrics, row.event_name as PartnerEventName);
    }
  }

  if (reviewResult.error) {
    hasPartialFailure = true;
    console.error("[admin-partner-metrics] review query failed", reviewResult.error.message);
  } else {
    for (const row of reviewResult.data ?? []) {
      const metrics = metricsByPartnerId.get(row.partner_id ?? "");
      if (!metrics) {
        continue;
      }
      metrics.reviewCount += 1;
    }
  }

  return {
    metricsByPartnerId,
    warningMessage: hasPartialFailure ? PARTNER_ADMIN_METRICS_WARNING_MESSAGE : null,
  };
}
