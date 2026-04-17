import type { PartnerPortalServiceMetrics } from "./partner-dashboard.ts";
import { listMockPartnerPortalSetupsInternal } from "./mock/partner-portal/store.ts";
import { isPartnerPortalMock } from "./partner-portal.ts";
import { getSupabaseAdminClient } from "./supabase/server.ts";

const PARTNER_SERVICE_METRICS_WARNING_MESSAGE =
  "일부 브랜드 집계를 불러오지 못해 최신 수치가 0으로 표시될 수 있습니다.";

export type PartnerServiceMetricsSnapshot = {
  metrics: PartnerPortalServiceMetrics;
  warningMessage?: string | null;
};

export function createEmptyPartnerServiceMetrics(): PartnerPortalServiceMetrics {
  return {
    detailViews: 0,
    cardClicks: 0,
    mapClicks: 0,
    reservationClicks: 0,
    inquiryClicks: 0,
    reviewCount: 0,
    totalClicks: 0,
  };
}

async function countPartnerEvent(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  partnerId: string,
  eventName: string,
  onError: () => void,
) {
  const { count, error } = await supabase
    .from("event_logs")
    .select("id", { count: "exact", head: true })
    .eq("target_type", "partner")
    .eq("target_id", partnerId)
    .eq("event_name", eventName);

  if (error) {
    onError();
    console.error("[partner-service-metrics] event query failed", {
      partnerId,
      eventName,
      message: error.message,
    });
    return 0;
  }

  return count ?? 0;
}

async function getSupabasePartnerServiceMetrics(
  partnerId: string,
): Promise<PartnerServiceMetricsSnapshot> {
  const supabase = getSupabaseAdminClient();
  let hasPartialFailure = false;
  const markPartialFailure = () => {
    hasPartialFailure = true;
  };

  const [
    detailViews,
    cardClicks,
    mapClicks,
    reservationClicks,
    inquiryClicks,
    reviewCount,
  ] = await Promise.all([
    countPartnerEvent(supabase, partnerId, "partner_detail_view", markPartialFailure),
    countPartnerEvent(supabase, partnerId, "partner_card_click", markPartialFailure),
    countPartnerEvent(supabase, partnerId, "partner_map_click", markPartialFailure),
    countPartnerEvent(supabase, partnerId, "reservation_click", markPartialFailure),
    countPartnerEvent(supabase, partnerId, "inquiry_click", markPartialFailure),
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

  return {
    metrics: {
      detailViews,
      cardClicks,
      mapClicks,
      reservationClicks,
      inquiryClicks,
      reviewCount,
      totalClicks: cardClicks + mapClicks + reservationClicks + inquiryClicks,
    },
    warningMessage: hasPartialFailure ? PARTNER_SERVICE_METRICS_WARNING_MESSAGE : null,
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

  return getSupabasePartnerServiceMetrics(partnerId);
}
