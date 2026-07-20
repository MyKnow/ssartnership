import type {
  PartnerPortalCompanySummary,
  PartnerPortalServiceSummary,
} from "./partner-portal.ts";
import type { PartnerCompanyPlanTier } from "./partner-company-plans.ts";
import { canAccessPartnerMetric } from "./partner-company-plans.ts";
import { isPartnerPortalMock } from "./partner-portal.ts";
import { getMockPartnerPortalDashboard } from "./mock/partner-portal.ts";
import { getSupabasePartnerPortalDashboard } from "./partner-dashboard.supabase.ts";

export type PartnerPortalServiceStatus =
  | "approved"
  | "pending"
  | "rejected";

export type PartnerPortalServiceMetrics = {
  favoriteCount: number;
  detailViews: number;
  detailUv: number;
  cardClicks: number;
  mapClicks: number;
  reservationClicks: number;
  inquiryClicks: number;
  benefitUsageCount?: number;
  reviewCount: number;
  totalClicks: number;
};

export type PartnerPortalServiceDashboard = PartnerPortalServiceSummary & {
  planTier: PartnerCompanyPlanTier;
  status: PartnerPortalServiceStatus;
  metrics: PartnerPortalServiceMetrics;
};

export type PartnerPortalCompanyDashboard = Omit<
  PartnerPortalCompanySummary,
  "services"
> & {
  services: PartnerPortalServiceDashboard[];
  totals: PartnerPortalServiceMetrics;
};

export type PartnerPortalDashboard = {
  companies: PartnerPortalCompanyDashboard[];
  totals: PartnerPortalServiceMetrics & {
    companyCount: number;
    serviceCount: number;
  };
  warningMessage?: string | null;
};

export interface PartnerPortalDashboardRepository {
  getDashboard(companyIds: string[]): Promise<PartnerPortalDashboard>;
}

const zeroMetrics = (): PartnerPortalServiceMetrics => ({
  favoriteCount: 0,
  detailViews: 0,
  detailUv: 0,
  cardClicks: 0,
  mapClicks: 0,
  reservationClicks: 0,
  inquiryClicks: 0,
  benefitUsageCount: 0,
  reviewCount: 0,
  totalClicks: 0,
});

function normalizeCompanyIds(companyIds: string[]) {
  return [...new Set(companyIds.map((id) => id.trim()).filter(Boolean))];
}

export function sumPartnerPortalMetrics(
  metricsList: PartnerPortalServiceMetrics[],
): PartnerPortalServiceMetrics {
  return metricsList.reduce<PartnerPortalServiceMetrics>(
    (accumulator, metrics) => ({
      favoriteCount: accumulator.favoriteCount + metrics.favoriteCount,
      detailViews: accumulator.detailViews + metrics.detailViews,
      detailUv: accumulator.detailUv + metrics.detailUv,
      cardClicks: accumulator.cardClicks + metrics.cardClicks,
      mapClicks: accumulator.mapClicks + metrics.mapClicks,
      reservationClicks:
        accumulator.reservationClicks + metrics.reservationClicks,
      inquiryClicks: accumulator.inquiryClicks + metrics.inquiryClicks,
      benefitUsageCount:
        (accumulator.benefitUsageCount ?? 0) + (metrics.benefitUsageCount ?? 0),
      reviewCount: accumulator.reviewCount + metrics.reviewCount,
      totalClicks: accumulator.totalClicks + metrics.totalClicks,
    }),
    zeroMetrics(),
  );
}

export function filterPartnerPortalMetricsForPlan(
  metrics: PartnerPortalServiceMetrics,
  planTier: PartnerCompanyPlanTier,
): PartnerPortalServiceMetrics {
  return {
    favoriteCount: canAccessPartnerMetric(planTier, "favoriteCount")
      ? metrics.favoriteCount
      : 0,
    detailViews: canAccessPartnerMetric(planTier, "detailViews")
      ? metrics.detailViews
      : 0,
    detailUv: canAccessPartnerMetric(planTier, "detailUv")
      ? metrics.detailUv
      : 0,
    cardClicks: canAccessPartnerMetric(planTier, "cardClicks")
      ? metrics.cardClicks
      : 0,
    mapClicks: canAccessPartnerMetric(planTier, "mapClicks")
      ? metrics.mapClicks
      : 0,
    reservationClicks: canAccessPartnerMetric(planTier, "reservationClicks")
      ? metrics.reservationClicks
      : 0,
    inquiryClicks: canAccessPartnerMetric(planTier, "inquiryClicks")
      ? metrics.inquiryClicks
      : 0,
    benefitUsageCount: canAccessPartnerMetric(planTier, "benefitUsageCount")
      ? metrics.benefitUsageCount ?? 0
      : 0,
    reviewCount: canAccessPartnerMetric(planTier, "reviewCount")
      ? metrics.reviewCount
      : 0,
    totalClicks: canAccessPartnerMetric(planTier, "totalClicks")
      ? metrics.totalClicks
      : 0,
  };
}

function createEmptyDashboard(): PartnerPortalDashboard {
  return {
    companies: [],
    totals: {
      ...zeroMetrics(),
      companyCount: 0,
      serviceCount: 0,
    },
    warningMessage: null,
  };
}

export function normalizePartnerPortalServiceStatus(
  value?: string | null,
): PartnerPortalServiceStatus {
  if (value === "pending" || value === "rejected") {
    return value;
  }

  return "approved";
}

export const partnerDashboardRepository: PartnerPortalDashboardRepository = {
  async getDashboard(companyIds: string[]) {
    const normalizedCompanyIds = normalizeCompanyIds(companyIds);
    if (normalizedCompanyIds.length === 0) {
      return createEmptyDashboard();
    }

    if (isPartnerPortalMock) {
      return getMockPartnerPortalDashboard(normalizedCompanyIds);
    }

    return getSupabasePartnerPortalDashboard(normalizedCompanyIds);
  },
};

export async function getPartnerPortalDashboard(companyIds: string[]) {
  return partnerDashboardRepository.getDashboard(companyIds);
}
