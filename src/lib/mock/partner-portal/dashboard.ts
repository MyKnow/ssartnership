import type {
  PartnerPortalCompanyDashboard,
  PartnerPortalDashboard,
  PartnerPortalServiceStatus,
} from "../../partner-dashboard.ts";
import {
  filterPartnerPortalMetricsForPlan,
  normalizePartnerPortalMetrics,
  sumPartnerPortalMetrics,
} from "../../partner-dashboard.ts";
import { getMockPartnerChangeRequestPartnerStatuses } from "../partner-change-requests.ts";
import type { MockPortalSetupRecord } from "./shared.ts";
import { listMockPartnerPortalCompanySetups } from "./store.ts";

function toDashboardCompany(
  record: MockPortalSetupRecord,
  statusByPartnerId: Map<string, PartnerPortalServiceStatus>,
): PartnerPortalCompanyDashboard {
  const services: PartnerPortalCompanyDashboard["services"] =
    record.company.services.map((service) => ({
      id: service.id,
      name: service.name,
      location: service.location,
      categoryLabel: service.categoryLabel,
      planTier: service.planTier,
      visibility: service.visibility,
      status: statusByPartnerId.get(service.id) ?? "approved",
      metrics: filterPartnerPortalMetricsForPlan(
        normalizePartnerPortalMetrics(service.metrics),
        service.planTier,
      ),
    }));

  return {
    id: record.company.id,
    name: record.company.name,
    slug: record.company.slug,
    description: record.company.description ?? null,
    services,
    totals: sumPartnerPortalMetrics(
      services.map((service) => service.metrics),
    ),
  };
}

export function buildMockPartnerPortalDashboardFromSetups(
  setups: MockPortalSetupRecord[],
): PartnerPortalDashboard {
  const partnerIds = setups.flatMap((setup) =>
    setup.company.services.map((service) => service.id),
  );
  const statusByPartnerId = getMockPartnerChangeRequestPartnerStatuses(partnerIds);
  const companies = setups.map((setup) =>
    toDashboardCompany(setup, statusByPartnerId),
  );
  const totals = sumPartnerPortalMetrics(
    companies.map((company) => company.totals),
  );

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

export async function getMockPartnerPortalDashboard(
  companyIds: string[],
): Promise<PartnerPortalDashboard> {
  const uniqueCompanyIds = [...new Set(companyIds.map((id) => id.trim()).filter(Boolean))];
  return buildMockPartnerPortalDashboardFromSetups(
    listMockPartnerPortalCompanySetups(uniqueCompanyIds),
  );
}
