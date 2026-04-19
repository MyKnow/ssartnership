import type {
  PartnerPortalCompanyDashboard,
  PartnerPortalDashboard,
  PartnerPortalServiceMetrics,
  PartnerPortalServiceStatus,
} from "../../partner-dashboard.ts";
import { getMockPartnerChangeRequestPartnerStatuses } from "../partner-change-requests.ts";
import type { MockPortalSetupRecord } from "./shared.ts";
import { listMockPartnerPortalCompanySetups } from "./store.ts";

function cloneMetrics(metrics: PartnerPortalServiceMetrics) {
  return {
    detailViews: metrics.detailViews,
    detailUv: metrics.detailUv,
    cardClicks: metrics.cardClicks,
    mapClicks: metrics.mapClicks,
    reservationClicks: metrics.reservationClicks,
    inquiryClicks: metrics.inquiryClicks,
    reviewCount: metrics.reviewCount,
    totalClicks: metrics.totalClicks,
  };
}

function normalizeMetrics(
  metrics?: Partial<PartnerPortalServiceMetrics> | null,
): PartnerPortalServiceMetrics {
  return {
    detailViews: metrics?.detailViews ?? 0,
    detailUv: metrics?.detailUv ?? 0,
    cardClicks: metrics?.cardClicks ?? 0,
    mapClicks: metrics?.mapClicks ?? 0,
    reservationClicks: metrics?.reservationClicks ?? 0,
    inquiryClicks: metrics?.inquiryClicks ?? 0,
    reviewCount: metrics?.reviewCount ?? 0,
    totalClicks: metrics?.totalClicks ?? 0,
  };
}

function sumMetrics(records: PartnerPortalServiceMetrics[]) {
  return records.reduce<PartnerPortalServiceMetrics>(
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
    {
      detailViews: 0,
      detailUv: 0,
      cardClicks: 0,
      mapClicks: 0,
      reservationClicks: 0,
      inquiryClicks: 0,
      reviewCount: 0,
      totalClicks: 0,
    },
  );
}

function toDashboardCompany(
  record: MockPortalSetupRecord,
  statusByPartnerId: Map<string, PartnerPortalServiceStatus>,
): PartnerPortalCompanyDashboard {
  return {
    id: record.company.id,
    name: record.company.name,
    slug: record.company.slug,
    description: record.company.description ?? null,
    services: record.company.services.map((service) => ({
      id: service.id,
      name: service.name,
      location: service.location,
      categoryLabel: service.categoryLabel,
      visibility: service.visibility,
      status: statusByPartnerId.get(service.id) ?? "approved",
      metrics: cloneMetrics(normalizeMetrics(service.metrics)),
    })),
    totals: sumMetrics(
      record.company.services.map((service) => normalizeMetrics(service.metrics)),
    ),
  };
}

export async function getMockPartnerPortalDashboard(
  companyIds: string[],
): Promise<PartnerPortalDashboard> {
  const uniqueCompanyIds = [...new Set(companyIds.map((id) => id.trim()).filter(Boolean))];
  const statusByPartnerId = getMockPartnerChangeRequestPartnerStatuses();
  const companies = listMockPartnerPortalCompanySetups(uniqueCompanyIds).map((setup) =>
    toDashboardCompany(setup, statusByPartnerId),
  );

  const totals = sumMetrics(companies.map((company) => company.totals));
  return {
    companies,
    totals: {
      ...totals,
      companyCount: companies.length,
      serviceCount: companies.reduce(
        (count, company) => count + company.services.length,
        0,
      ),
    },
  };
}
