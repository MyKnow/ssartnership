import type {
  PartnerPortalCompanySummary,
  PartnerPortalServiceSummary,
} from "./partner-portal.ts";
import { isPartnerPortalMock } from "./partner-portal.ts";
import { getMockPartnerPortalDashboard } from "./mock/partner-portal.ts";
import { getSupabasePartnerPortalDashboard } from "./partner-dashboard.supabase.ts";

export type PartnerPortalServiceStatus =
  | "approved"
  | "pending"
  | "rejected";

export type PartnerPortalServiceMetrics = {
  detailViews: number;
  detailUv: number;
  cardClicks: number;
  mapClicks: number;
  reservationClicks: number;
  inquiryClicks: number;
  reviewCount: number;
  totalClicks: number;
};

export type PartnerPortalServiceDashboard = PartnerPortalServiceSummary & {
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
  detailViews: 0,
  detailUv: 0,
  cardClicks: 0,
  mapClicks: 0,
  reservationClicks: 0,
  inquiryClicks: 0,
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
      detailViews: accumulator.detailViews + metrics.detailViews,
      detailUv: accumulator.detailUv + metrics.detailUv,
      cardClicks: accumulator.cardClicks + metrics.cardClicks,
      mapClicks: accumulator.mapClicks + metrics.mapClicks,
      reservationClicks:
        accumulator.reservationClicks + metrics.reservationClicks,
      inquiryClicks: accumulator.inquiryClicks + metrics.inquiryClicks,
      reviewCount: accumulator.reviewCount + metrics.reviewCount,
      totalClicks: accumulator.totalClicks + metrics.totalClicks,
    }),
    zeroMetrics(),
  );
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

export function getPartnerPortalServiceStatusLabel(
  status: PartnerPortalServiceStatus,
) {
  switch (status) {
    case "pending":
      return "승인 대기 중";
    case "rejected":
      return "수정 반려됨";
    default:
      return "승인됨";
  }
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
