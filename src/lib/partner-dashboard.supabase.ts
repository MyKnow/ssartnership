import { getSupabaseAdminClient } from "./supabase/server.ts";
import {
  applyPartnerMetricRollupRows,
  fetchPartnerMetricRollupRows,
  PARTNER_METRIC_EVENT_NAMES,
} from "./partner-metric-rollups.ts";
import {
  type PartnerPortalCompanyDashboard,
  type PartnerPortalDashboard,
  type PartnerPortalServiceDashboard,
  type PartnerPortalServiceMetrics,
  normalizePartnerPortalServiceStatus,
  sumPartnerPortalMetrics,
} from "./partner-dashboard.ts";
import { normalizePartnerVisibility } from "./partner-visibility.ts";

type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
};

type PartnerServiceRow = {
  id: string;
  company_id?: string | null;
  name: string;
  location: string;
  visibility?: string | null;
  categories?:
    | { label?: string | null }
    | Array<{ label?: string | null }>
    | null;
};

type PartnerChangeRequestRow = {
  partner_id: string;
  status?: string | null;
  updated_at?: string | null;
};

const PARTNER_DASHBOARD_WARNING_MESSAGE =
  "일부 통계를 불러오지 못해 최신 수치가 0으로 표시될 수 있습니다.";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_PATTERN.test(value.trim());
}

function extractCategoryLabel(
  categories: PartnerServiceRow["categories"],
) {
  if (!categories) {
    return "제휴";
  }
  if (Array.isArray(categories)) {
    return categories[0]?.label ?? "제휴";
  }
  return categories.label ?? "제휴";
}

function createEmptyMetrics(): PartnerPortalServiceMetrics {
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

function normalizeSupabaseCompanyIds(companyIds: string[]) {
  return [
    ...new Set(
      companyIds
        .map((id) => id.trim())
        .filter((id): id is string => Boolean(id) && isUuid(id)),
    ),
  ];
}

function toServiceDashboard(
  row: PartnerServiceRow,
  metrics: PartnerPortalServiceMetrics,
  status: string | null | undefined,
): PartnerPortalServiceDashboard {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    categoryLabel: extractCategoryLabel(row.categories),
    visibility: normalizePartnerVisibility(row.visibility),
    status: normalizePartnerPortalServiceStatus(status),
    metrics,
  };
}

function toCompanyDashboard(
  row: PartnerCompanyRow,
  services: PartnerPortalServiceDashboard[],
): PartnerPortalCompanyDashboard {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    services,
    totals: sumPartnerPortalMetrics(services.map((service) => service.metrics)),
  };
}

export async function getSupabasePartnerPortalDashboard(
  companyIds: string[],
): Promise<PartnerPortalDashboard> {
  const uniqueCompanyIds = normalizeSupabaseCompanyIds(companyIds);
  if (uniqueCompanyIds.length === 0) {
    return {
      companies: [],
      totals: {
        ...createEmptyMetrics(),
        companyCount: 0,
        serviceCount: 0,
      },
      warningMessage: null,
    };
  }

  const supabase = getSupabaseAdminClient();
  let hasPartialFailure = false;
  const markPartialFailure = () => {
    hasPartialFailure = true;
  };
  const [companyResult, serviceResult, changeRequestResult] = await Promise.all([
    supabase
      .from("partner_companies")
      .select("id,name,slug,description,is_active")
      .in("id", uniqueCompanyIds)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("partners")
      .select("id,company_id,name,location,visibility,categories(label)")
      .in("company_id", uniqueCompanyIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("partner_change_requests")
      .select("partner_id,status,updated_at")
      .in("company_id", uniqueCompanyIds)
      .order("updated_at", { ascending: false }),
  ]);

  if (companyResult.error) {
    markPartialFailure();
    console.error(
      "[partner-dashboard] company query failed",
      companyResult.error.message,
    );
  }
  if (serviceResult.error) {
    markPartialFailure();
    console.error(
      "[partner-dashboard] service query failed",
      serviceResult.error.message,
    );
  }
  if (changeRequestResult.error) {
    markPartialFailure();
    console.error(
      "[partner-dashboard] change request query failed",
      changeRequestResult.error.message,
    );
  }

  const companyRows = (companyResult.error ? [] : companyResult.data ?? []) as PartnerCompanyRow[];
  const serviceRows = (serviceResult.error ? [] : serviceResult.data ?? []) as PartnerServiceRow[];
  const requestRows = (
    changeRequestResult.error ? [] : changeRequestResult.data ?? []
  ) as PartnerChangeRequestRow[];
  const statusByPartnerId = new Map<string, string | null | undefined>();

  for (const request of requestRows) {
    if (statusByPartnerId.has(request.partner_id)) {
      continue;
    }

    statusByPartnerId.set(request.partner_id, request.status ?? null);
  }

  const serviceMetricsEntries = serviceRows.map((row) => [
    row.id,
    createEmptyMetrics(),
  ] as const);
  const metricsByServiceId = new Map(serviceMetricsEntries);

  const rollupResult = await fetchPartnerMetricRollupRows(supabase, {
    partnerIds: serviceRows.map((serviceRow) => serviceRow.id),
    metricNames: PARTNER_METRIC_EVENT_NAMES,
    granularity: "total",
  });

  if (rollupResult.errorMessage) {
    markPartialFailure();
    console.error(
      "[partner-dashboard] event metric query failed",
      rollupResult.errorMessage,
    );
  } else {
    applyPartnerMetricRollupRows(metricsByServiceId, rollupResult.rows);
  }

  const reviewCountResult = await Promise.all(
    serviceRows.map(async (row) => {
      const { count, error } = await supabase
        .from("partner_reviews")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", row.id)
        .is("deleted_at", null);

      if (error) {
        markPartialFailure();
        console.error("[partner-dashboard] review metric query failed", {
          partnerId: row.id,
          message: error.message,
        });
        return [row.id, 0] as const;
      }

      return [row.id, count ?? 0] as const;
    }),
  );

  for (const [partnerId, reviewCount] of reviewCountResult) {
    const metrics = metricsByServiceId.get(partnerId);
    if (!metrics) {
      continue;
    }
    metrics.reviewCount = reviewCount;
  }

  const companies = companyRows.map((row) => {
    const services = serviceRows
      .filter((serviceRow) => serviceRow.company_id === row.id)
      .map((serviceRow) =>
        toServiceDashboard(
          serviceRow,
          metricsByServiceId.get(serviceRow.id) ?? createEmptyMetrics(),
          statusByPartnerId.get(serviceRow.id),
        ),
      );
    return toCompanyDashboard(row, services);
  });

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
    warningMessage: hasPartialFailure ? PARTNER_DASHBOARD_WARNING_MESSAGE : null,
  };
}
