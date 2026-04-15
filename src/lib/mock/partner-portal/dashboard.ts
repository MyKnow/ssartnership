import type {
  PartnerPortalCompanyDashboard,
  PartnerPortalDashboard,
  PartnerPortalServiceMetrics,
} from "../../partner-dashboard.ts";
import { getMockPartnerChangeRequestCompanyStatuses } from "../partner-change-requests.ts";
import type { MockPortalSetupRecord } from "./shared.ts";
import { listMockPartnerPortalCompanySetups } from "./store.ts";

function cloneMetrics(metrics: PartnerPortalServiceMetrics) {
  return {
    detailViews: metrics.detailViews,
    cardClicks: metrics.cardClicks,
    mapClicks: metrics.mapClicks,
    reservationClicks: metrics.reservationClicks,
    inquiryClicks: metrics.inquiryClicks,
    totalClicks: metrics.totalClicks,
  };
}

function normalizeMetrics(
  metrics?: Partial<PartnerPortalServiceMetrics> | null,
): PartnerPortalServiceMetrics {
  return {
    detailViews: metrics?.detailViews ?? 0,
    cardClicks: metrics?.cardClicks ?? 0,
    mapClicks: metrics?.mapClicks ?? 0,
    reservationClicks: metrics?.reservationClicks ?? 0,
    inquiryClicks: metrics?.inquiryClicks ?? 0,
    totalClicks: metrics?.totalClicks ?? 0,
  };
}

function sumMetrics(records: PartnerPortalServiceMetrics[]) {
  return records.reduce<PartnerPortalServiceMetrics>(
    (accumulator, metrics) => ({
      detailViews: accumulator.detailViews + metrics.detailViews,
      cardClicks: accumulator.cardClicks + metrics.cardClicks,
      mapClicks: accumulator.mapClicks + metrics.mapClicks,
      reservationClicks:
        accumulator.reservationClicks + metrics.reservationClicks,
      inquiryClicks: accumulator.inquiryClicks + metrics.inquiryClicks,
      totalClicks: accumulator.totalClicks + metrics.totalClicks,
    }),
    {
      detailViews: 0,
      cardClicks: 0,
      mapClicks: 0,
      reservationClicks: 0,
      inquiryClicks: 0,
      totalClicks: 0,
    },
  );
}

function toDashboardCompany(
  record: MockPortalSetupRecord,
  status: PartnerPortalCompanyDashboard["status"],
): PartnerPortalCompanyDashboard {
  return {
    id: record.company.id,
    name: record.company.name,
    slug: record.company.slug,
    description: record.company.description ?? null,
    contactName: record.company.contactName ?? null,
    contactEmail: record.company.contactEmail ?? null,
    contactPhone: record.company.contactPhone ?? null,
    status,
    services: record.company.services.map((service) => ({
      id: service.id,
      name: service.name,
      location: service.location,
      categoryLabel: service.categoryLabel,
      visibility: service.visibility,
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
  const statusByCompanyId = getMockPartnerChangeRequestCompanyStatuses(
    uniqueCompanyIds,
  );
  const companies = listMockPartnerPortalCompanySetups(uniqueCompanyIds).map((setup) =>
    toDashboardCompany(
      setup,
      statusByCompanyId.get(setup.company.id) ?? "approved",
    ),
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
