import {
  normalizePartnerCompanyPlanTier,
  resolvePartnerBrandPlanWindow,
} from "@/lib/partner-company-plans";
import { normalizePartnerPlanUpgradeRequestStatus } from "@/lib/partner-plan-upgrades";
import { getPartnerBillingInvoiceSummariesForUpgradeRequests } from "@/lib/partner-plan-service";
import { normalizePartnerVisibility } from "@/lib/partner-visibility";
import type { AdminPartnerListFilters } from "@/lib/admin-ia";
import { withAdminReadModelTimeout } from "@/lib/admin-read-model-timeout";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";

export const ADMIN_PARTNER_LIST_READ_MODEL_TIMEOUT_MS = 3_000;
export const ADMIN_PARTNER_CATEGORIES_CACHE_REVALIDATE_SECONDS = 60;

type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
  managed_campus_slugs?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PartnerPlanUpgradeRequestRow = {
  id: string;
  partner_id?: string | null;
  company_id: string;
  requested_by_account_id: string;
  current_plan_tier: string;
  requested_plan_tier: string;
  status: string;
  payment_amount_krw: number;
  payer_name: string;
  memo: string;
  admin_note: string;
  reviewed_at?: string | null;
  created_at: string;
  brand?: { id: string; name: string } | { id: string; name: string }[] | null;
  company?: PartnerCompanyRow | PartnerCompanyRow[] | null;
  requested_by?: { id: string; display_name: string | null } | { id: string; display_name: string | null }[] | null;
};

type PartnerPlanEventRow = {
  id: string;
  partner_id?: string | null;
  company_id: string;
  previous_plan_tier?: string | null;
  next_plan_tier: string;
  source: "admin" | "partner_upgrade" | "expiration" | "system";
  note: string;
  created_at: string;
  brand?: { id: string; name: string } | { id: string; name: string }[] | null;
};

type AdminPartnerListRow = {
  id: string;
  name: string;
  category_id?: string | null;
  company_id?: string | null;
  location?: string | null;
  managed_campus_slugs?: string[] | null;
  map_url?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  applies_to?: string[] | null;
  visibility?: string | null;
  plan_tier?: string | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
  plan_updated_at?: string | null;
  company?: PartnerCompanyRow | PartnerCompanyRow[] | null;
};

type AdminPartnerCategoryRow = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  color: string | null;
};

const getCachedAdminPartnerCategories = unstable_cache(
  async (): Promise<AdminPartnerCategoryRow[]> => {
    const { data } = await getSupabaseAdminClient()
      .from("categories")
      .select("id,key,label,description,color")
      .order("created_at", { ascending: true });

    return (data ?? []) as AdminPartnerCategoryRow[];
  },
  ["admin-partner-categories"],
  {
    revalidate: ADMIN_PARTNER_CATEGORIES_CACHE_REVALIDATE_SECONDS,
    tags: ["categories"],
  },
);

function normalizePartnerCompany(value: unknown): PartnerCompanyRow | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return (value[0] as PartnerCompanyRow | undefined) ?? null;
  }
  return typeof value === "object" ? (value as PartnerCompanyRow) : null;
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

function getPartnerNameSearchPattern(value: string) {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

/**
 * Server read model for the high-frequency partner list and plan view.
 * It keeps pagination, campus scope, minimal projections, and relationship
 * normalization out of the route component.
 */
function createEmptyAdminPartnerListReadModel({
  filters,
  showPlans,
}: {
  filters: AdminPartnerListFilters;
  showPlans: boolean;
}) {
  return {
    categories: [],
    filters,
    partners: [],
    totalPartnerCount: 0,
    totalPartnerPages: 1,
    shouldRedirectToLastPage: false,
    hasPartnerLoadError: true,
    hasPlanLoadError: showPlans,
    publicCount: 0,
    confidentialCount: 0,
    privateCount: 0,
    planBrands: [],
    planRequests: [],
    planEvents: [],
  };
}

async function getAdminPartnerListReadModelUnbounded({
  filters,
  showPlans,
  managedCampusSlugs,
}: {
  filters: AdminPartnerListFilters;
  showPlans: boolean;
  managedCampusSlugs: readonly string[] | null;
}) {
  const supabase = getSupabaseAdminClient();
  const categoriesPromise = getCachedAdminPartnerCategories();
  const categoriesResultForFilter =
    filters.categoryKey === "all" ? null : await categoriesPromise;
  const categoriesForFilter = categoriesResultForFilter ?? [];
  const selectedCategory =
    filters.categoryKey === "all"
      ? null
      : categoriesForFilter.find((category) => category.key === filters.categoryKey) ?? null;
  const normalizedFilters = {
    ...filters,
    categoryKey: selectedCategory?.key ?? "all",
  };
  const partnerFields = showPlans
    ? "id,name,company_id,location,period_start,period_end,plan_tier,plan_started_at,plan_expires_at,plan_updated_at,visibility,company:partner_companies(id,name,slug)"
    : "id,name,category_id,company_id,location,managed_campus_slugs,map_url,period_start,period_end,applies_to,visibility,company:partner_companies(id,name,slug)";
  let partnersQuery = showPlans
    ? supabase.from("partners").select(partnerFields)
    : supabase.from("partners").select(partnerFields, { count: "exact" });
  if (managedCampusSlugs) {
    partnersQuery = partnersQuery.overlaps("managed_campus_slugs", [
      ...managedCampusSlugs,
    ]);
  }
  if (!showPlans && selectedCategory) {
    partnersQuery = partnersQuery.eq("category_id", selectedCategory.id);
  }
  if (!showPlans && normalizedFilters.searchValue) {
    partnersQuery = partnersQuery.ilike(
      "name",
      getPartnerNameSearchPattern(normalizedFilters.searchValue),
    );
  }
  if (!showPlans && normalizedFilters.visibility !== "all") {
    partnersQuery = partnersQuery.eq("visibility", normalizedFilters.visibility);
  }
  partnersQuery =
    normalizedFilters.sort === "endingSoon" && !showPlans
      ? partnersQuery
          .order("period_end", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
      : partnersQuery.order("created_at", { ascending: false });
  if (!showPlans) {
    const from = (normalizedFilters.page - 1) * normalizedFilters.pageSize;
    partnersQuery = partnersQuery.range(
      from,
      from + normalizedFilters.pageSize - 1,
    );
  }

  const [partnersResult, planRequestsResult, planEventsResult, categoriesResult] = await Promise.all([
    partnersQuery,
    showPlans
      ? supabase
          .from("partner_plan_upgrade_requests")
          .select(
            "id,partner_id,company_id,requested_by_account_id,current_plan_tier,requested_plan_tier,status,payment_amount_krw,payer_name,memo,admin_note,reviewed_at,created_at,brand:partners!partner_plan_upgrade_requests_partner_id_fkey(id,name),company:partner_companies(id,name,slug),requested_by:partner_accounts!partner_plan_upgrade_requests_requested_by_account_id_fkey(id,display_name)",
          )
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
    showPlans
      ? supabase
          .from("partner_brand_plan_events")
          .select(
            "id,partner_id,company_id,previous_plan_tier,next_plan_tier,source,note,created_at,brand:partners(id,name)",
          )
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    categoriesPromise,
  ]);
  const categories = categoriesResult;

  const partnerRows = (partnersResult.data ?? []) as unknown as AdminPartnerListRow[];
  const partners = partnerRows.map((partner) => ({
    ...partner,
    category_id: partner.category_id ?? "",
    company_id: partner.company_id ?? null,
    location: partner.location ?? "",
    visibility: normalizePartnerVisibility(partner.visibility),
    company: normalizePartnerCompany(partner.company),
  }));
  const totalPartnerCount = showPlans ? partners.length : partnersResult.count ?? 0;
  const totalPartnerPages = Math.max(
    1,
    Math.ceil(totalPartnerCount / normalizedFilters.pageSize),
  );
  const scopedPartnerIds = new Set(partners.map((partner) => partner.id));
  const scopedCompanyIds = new Set(
    partners
      .map((partner) => partner.company_id ?? partner.company?.id ?? null)
      .filter((companyId): companyId is string => Boolean(companyId)),
  );
  const hasPartnerLoadError = Boolean(partnersResult.error);
  const hasPlanLoadError = Boolean(planRequestsResult.error || planEventsResult.error);
  const publicCount = partners.filter((partner) => partner.visibility === "public").length;
  const confidentialCount = partners.filter(
    (partner) => partner.visibility === "confidential",
  ).length;
  const privateCount = partners.filter((partner) => partner.visibility === "private").length;
  const planBrands = partners.map((partner) => {
    const planTier = normalizePartnerCompanyPlanTier(
      (partner as { plan_tier?: string | null }).plan_tier,
    );
    const planWindow = resolvePartnerBrandPlanWindow({
      planTier,
      periodStart: (partner as { period_start?: string | null }).period_start ?? null,
      periodEnd: (partner as { period_end?: string | null }).period_end ?? null,
      planStartedAt:
        (partner as { plan_started_at?: string | null }).plan_started_at ?? null,
      planExpiresAt:
        (partner as { plan_expires_at?: string | null }).plan_expires_at ?? null,
    });

    return {
      id: partner.id,
      name: partner.name,
      companyId: partner.company_id ?? partner.company?.id ?? "",
      companyName: partner.company?.name ?? "미지정",
      location: partner.location,
      periodStart: partner.period_start ?? null,
      periodEnd: partner.period_end ?? null,
      planTier,
      planStartedAt: planWindow.planStartedAt,
      planExpiresAt: planWindow.planExpiresAt,
      planUpdatedAt:
        (partner as { plan_updated_at?: string | null }).plan_updated_at ?? null,
    };
  });
  const mappedPlanRequests = (
    (planRequestsResult.data ?? []) as PartnerPlanUpgradeRequestRow[]
  )
    .filter((request) => {
      if (!managedCampusSlugs) {
        return true;
      }
      return (
        (request.partner_id ? scopedPartnerIds.has(request.partner_id) : false) ||
        scopedCompanyIds.has(request.company_id)
      );
    })
    .map((request) => {
      const brand = normalizeRelation(request.brand);
      const company = normalizeRelation(request.company);
      const requestedBy = normalizeRelation(request.requested_by);
      return {
        id: request.id,
        partnerId: request.partner_id ?? brand?.id ?? "",
        brandName: brand?.name ?? "미지정 제휴처",
        companyId: request.company_id,
        companyName: company?.name ?? "미지정",
        requestedByDisplayName: requestedBy?.display_name ?? null,
        currentPlanTier: normalizePartnerCompanyPlanTier(request.current_plan_tier),
        requestedPlanTier: normalizePartnerCompanyPlanTier(request.requested_plan_tier),
        status: normalizePartnerPlanUpgradeRequestStatus(request.status),
        paymentAmountKrw: Math.max(0, Number(request.payment_amount_krw ?? 0)),
        payerName: request.payer_name ?? "",
        memo: request.memo ?? "",
        adminNote: request.admin_note ?? "",
        reviewedAt: request.reviewed_at ?? null,
        createdAt: request.created_at,
      };
    });
  const billingByRequestId = await getPartnerBillingInvoiceSummariesForUpgradeRequests(
    mappedPlanRequests.map((request) => request.id),
  );
  const planRequests = mappedPlanRequests.map((request) => ({
    ...request,
    billingInvoice: billingByRequestId.get(request.id) ?? null,
  }));
  const planEvents = ((planEventsResult.data ?? []) as PartnerPlanEventRow[])
    .filter((event) => {
      if (!managedCampusSlugs) {
        return true;
      }
      return (
        (event.partner_id ? scopedPartnerIds.has(event.partner_id) : false) ||
        scopedCompanyIds.has(event.company_id)
      );
    })
    .map((event) => {
      const brand = normalizeRelation(event.brand);
      return {
        id: event.id,
        partnerId: event.partner_id ?? brand?.id ?? "",
        brandName: brand?.name ?? null,
        companyId: event.company_id,
        previousPlanTier: event.previous_plan_tier
          ? normalizePartnerCompanyPlanTier(event.previous_plan_tier)
          : null,
        nextPlanTier: normalizePartnerCompanyPlanTier(event.next_plan_tier),
        source: event.source,
        note: event.note ?? "",
        createdAt: event.created_at,
      };
    });

  return {
    categories,
    filters: normalizedFilters,
    partners,
    totalPartnerCount,
    totalPartnerPages,
    shouldRedirectToLastPage:
      !showPlans && !partnersResult.error && normalizedFilters.page > totalPartnerPages,
    hasPartnerLoadError,
    hasPlanLoadError,
    publicCount,
    confidentialCount,
    privateCount,
    planBrands,
    planRequests,
    planEvents,
  };
}

export async function getAdminPartnerListReadModel({
  filters,
  showPlans,
  managedCampusSlugs,
}: {
  filters: AdminPartnerListFilters;
  showPlans: boolean;
  managedCampusSlugs: readonly string[] | null;
}) {
  return withAdminReadModelTimeout(
    getAdminPartnerListReadModelUnbounded({
      filters,
      showPlans,
      managedCampusSlugs,
    }),
    createEmptyAdminPartnerListReadModel({ filters, showPlans }),
    ADMIN_PARTNER_LIST_READ_MODEL_TIMEOUT_MS,
  );
}
