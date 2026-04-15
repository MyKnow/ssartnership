import { getSupabaseAdminClient } from "./supabase/server.ts";
import {
  type PartnerPortalCompanyDashboard,
  type PartnerPortalDashboard,
  type PartnerPortalServiceDashboard,
  type PartnerPortalServiceMetrics,
  normalizePartnerPortalCompanyStatus,
  sumPartnerPortalMetrics,
} from "./partner-dashboard.ts";
import { normalizePartnerVisibility } from "./partner-visibility.ts";

type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
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
  company_id: string;
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
    console.error("[partner-dashboard] event metric query failed", {
      partnerId,
      eventName,
      message: error.message,
    });
    return 0;
  }

  return count ?? 0;
}

async function getServiceMetrics(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  partnerId: string,
  onError: () => void,
) {
  const [detailViews, cardClicks, mapClicks, reservationClicks, inquiryClicks] =
    await Promise.all([
      countPartnerEvent(supabase, partnerId, "partner_detail_view", onError),
      countPartnerEvent(supabase, partnerId, "partner_card_click", onError),
      countPartnerEvent(supabase, partnerId, "partner_map_click", onError),
      countPartnerEvent(supabase, partnerId, "reservation_click", onError),
      countPartnerEvent(supabase, partnerId, "inquiry_click", onError),
    ]);

  return {
    detailViews,
    cardClicks,
    mapClicks,
    reservationClicks,
    inquiryClicks,
    totalClicks:
      cardClicks + mapClicks + reservationClicks + inquiryClicks,
  } satisfies PartnerPortalServiceMetrics;
}

function toServiceDashboard(
  row: PartnerServiceRow,
  metrics: PartnerPortalServiceMetrics,
): PartnerPortalServiceDashboard {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    categoryLabel: extractCategoryLabel(row.categories),
    visibility: normalizePartnerVisibility(row.visibility),
    metrics,
  };
}

function toCompanyDashboard(
  row: PartnerCompanyRow,
  services: PartnerPortalServiceDashboard[],
  status: string | null | undefined,
): PartnerPortalCompanyDashboard {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    contactName: row.contact_name ?? null,
    contactEmail: row.contact_email ?? null,
    contactPhone: row.contact_phone ?? null,
    status: normalizePartnerPortalCompanyStatus(status),
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
      .select("id,name,slug,description,contact_name,contact_email,contact_phone,is_active")
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
      .select("company_id,status,updated_at")
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
  const statusByCompanyId = new Map<string, string | null | undefined>();

  for (const request of requestRows) {
    if (statusByCompanyId.has(request.company_id)) {
      continue;
    }

    statusByCompanyId.set(request.company_id, request.status ?? null);
  }

  const serviceMetricsEntries = await Promise.all(
    serviceRows.map(async (row) => {
      const metrics = await getServiceMetrics(supabase, row.id, markPartialFailure);
      return [row.id, metrics] as const;
    }),
  );
  const metricsByServiceId = new Map(serviceMetricsEntries);

  const companies = companyRows.map((row) => {
    const services = serviceRows
      .filter((serviceRow) => serviceRow.company_id === row.id)
      .map((serviceRow) =>
        toServiceDashboard(
          serviceRow,
          metricsByServiceId.get(serviceRow.id) ?? createEmptyMetrics(),
        ),
      );
    return toCompanyDashboard(row, services, statusByCompanyId.get(row.id));
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
