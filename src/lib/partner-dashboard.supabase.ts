import { getSupabaseAdminClient } from "./supabase/server.ts";
import {
  type PartnerPortalCompanyDashboard,
  type PartnerPortalDashboard,
  type PartnerPortalServiceDashboard,
  type PartnerPortalServiceMetrics,
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
) {
  const { count, error } = await supabase
    .from("event_logs")
    .select("id", { count: "exact", head: true })
    .eq("target_type", "partner")
    .eq("target_id", partnerId)
    .eq("event_name", eventName);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function getServiceMetrics(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  partnerId: string,
) {
  const [detailViews, cardClicks, mapClicks, reservationClicks, inquiryClicks] =
    await Promise.all([
      countPartnerEvent(supabase, partnerId, "partner_detail_view"),
      countPartnerEvent(supabase, partnerId, "partner_card_click"),
      countPartnerEvent(supabase, partnerId, "partner_map_click"),
      countPartnerEvent(supabase, partnerId, "reservation_click"),
      countPartnerEvent(supabase, partnerId, "inquiry_click"),
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
): PartnerPortalCompanyDashboard {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    contactName: row.contact_name ?? null,
    contactEmail: row.contact_email ?? null,
    contactPhone: row.contact_phone ?? null,
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
    };
  }

  const supabase = getSupabaseAdminClient();
  const [companyResult, serviceResult] = await Promise.all([
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
  ]);

  if (companyResult.error) {
    throw new Error(companyResult.error.message);
  }
  if (serviceResult.error) {
    throw new Error(serviceResult.error.message);
  }

  const companyRows = (companyResult.data ?? []) as PartnerCompanyRow[];
  const serviceRows = (serviceResult.data ?? []) as PartnerServiceRow[];

  const serviceMetricsEntries = await Promise.all(
    serviceRows.map(async (row) => {
      const metrics = await getServiceMetrics(supabase, row.id);
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
  };
}
