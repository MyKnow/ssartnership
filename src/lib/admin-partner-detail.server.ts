import {
  getAdminPartnerMetrics,
} from "@/lib/admin-partner-metrics";
import {
  getAdminReviewPageData,
  type AdminReviewFilters,
} from "@/lib/admin-reviews";
import { fetchPartnerReviewVisibilityCounts } from "@/lib/partner-counts";
import { getPartnerMetricTimeseriesSnapshot } from "@/lib/partner-metric-timeseries";
import { fetchRequestSummariesForPartner } from "@/lib/partner-change-requests/summary";
import {
  adPackageRepository,
  partnerBenefitUsageRepository,
} from "@/lib/repositories";
import type {
  AdCampaignWithStats,
  AdCoupon,
} from "@/lib/repositories/ad-package-repository";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
  managed_campus_slugs?: string[] | null;
};

type PartnerCategoryRow = {
  id: string;
  key: string;
  label: string;
  color?: string | null;
  description?: string | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

const PARTNER_DETAIL_SELECT =
  "id,created_at,name,category_id,company_id,location,detail_description,campus_slugs,managed_campus_slugs,thumbnail,map_url,benefit_action_type,benefit_action_link,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,partner_benefits(id,title,max_apply_count,display_order),applies_to,images,tags,visibility,benefit_visibility,benefit_verification_pin_hash,benefit_verification_pin_salt,company:partner_companies(id,name,slug,description,is_active,managed_campus_slugs),categories(id,key,label,color,description)";

const PARTNER_AUDIT_ACTIONS = [
  "partner_create",
  "partner_update",
  "partner_change_request_approve",
  "partner_change_request_reject",
  "partner_portal_immediate_update",
  "partner_portal_change_request_submit",
  "partner_portal_change_request_cancel",
  "partner_company_create",
  "partner_company_update",
  "partner_company_delete",
] as const;

function parseUsagePage(value: string) {
  const page = Number.parseInt(value, 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/**
 * Provides the partner-detail route with a scoped, page-sized read model.
 * Database error details remain on the server; routes only receive a stable
 * state they can recover from without leaking implementation details.
 */
export async function getAdminPartnerDetailReadModel({
  partnerId,
  managedCampusSlugs,
  reviewFilters,
  canReadCoupons,
  requestedUsageBenefit,
  usagePage,
}: {
  partnerId: string;
  managedCampusSlugs: readonly string[] | null;
  reviewFilters: AdminReviewFilters;
  canReadCoupons: boolean;
  requestedUsageBenefit: string;
  usagePage: string;
}) {
  try {
    const supabase = getSupabaseAdminClient();
    let companiesQuery = supabase
      .from("partner_companies")
      .select("id,name,slug,description,is_active,managed_campus_slugs")
      .order("name", { ascending: true });
    if (managedCampusSlugs) {
      companiesQuery = companiesQuery.overlaps("managed_campus_slugs", [
        ...managedCampusSlugs,
      ]);
    }

    const couponManagementDataPromise = canReadCoupons
      ? Promise.all([
          adPackageRepository.listAdminCampaigns(),
          adPackageRepository.listAdminCouponsForPartner(partnerId),
        ])
      : Promise.resolve<[AdCampaignWithStats[], AdCoupon[]]>([[], []]);
    const [
      categoriesResult,
      companiesResult,
      partnerResult,
      metricsResult,
      reviewData,
      reviewCountResult,
      previewTokenResult,
      couponManagementData,
    ] = await Promise.all([
      supabase
        .from("categories")
        .select("id,key,label,description,color")
        .order("created_at", { ascending: true }),
      companiesQuery,
      supabase
        .from("partners")
        .select(PARTNER_DETAIL_SELECT)
        .eq("id", partnerId)
        .maybeSingle(),
      getAdminPartnerMetrics([partnerId]),
      getAdminReviewPageData(reviewFilters, {
        includeCounts: false,
        managedCampusSlugs,
      }),
      fetchPartnerReviewVisibilityCounts(supabase, partnerId),
      supabase
        .from("partner_preview_tokens")
        .select("created_at,token_ciphertext,token_nonce,token_auth_tag,token_key_version")
        .eq("partner_id", partnerId)
        .maybeSingle(),
      couponManagementDataPromise,
    ]);

    if (partnerResult.error || categoriesResult.error || companiesResult.error) {
      return { status: "error" as const };
    }
    if (!partnerResult.data) {
      return { status: "not_found" as const };
    }

    const partner = partnerResult.data;
    const company = normalizeRelation<PartnerCompanyRow>(
      (partner as { company?: PartnerCompanyRow | PartnerCompanyRow[] | null }).company,
    );
    const category = normalizeRelation<PartnerCategoryRow>(
      (partner as {
        categories?: PartnerCategoryRow | PartnerCategoryRow[] | null;
      }).categories,
    );
    const selectedUsageBenefit = (partner.benefits ?? []).includes(requestedUsageBenefit)
      ? requestedUsageBenefit
      : null;
    const auditTargetIds = Array.from(
      new Set(
        [partner.id, company?.id ?? partner.company_id ?? null].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    );
    const [usageHistory, metricTimeseries, partnerAuditLogsResult, partnerRequestHistory] =
      await Promise.all([
        partnerBenefitUsageRepository.listUsageHistory({
          partnerId,
          benefit: selectedUsageBenefit,
          page: parseUsagePage(usagePage),
          pageSize: 25,
        }),
        getPartnerMetricTimeseriesSnapshot(partnerId, partner.created_at),
        supabase
          .from("admin_audit_logs")
          .select("id,actor_id,action,target_type,target_id,properties,created_at")
          .in("action", PARTNER_AUDIT_ACTIONS as unknown as string[])
          .in("target_type", ["partner", "partner_company", "partner_change_request"])
          .order("created_at", { ascending: false })
          .limit(200),
        fetchRequestSummariesForPartner(supabase, partnerId, { limit: 50 }),
      ]);
    const partnerAuditLogs = (partnerAuditLogsResult.data ?? []).filter((log) => {
      const properties = log.properties && typeof log.properties === "object"
        ? (log.properties as Record<string, unknown>)
        : null;
      const logPartnerId =
        typeof properties?.partnerId === "string" ? properties.partnerId : null;
      const logCompanyId =
        typeof properties?.companyId === "string" ? properties.companyId : null;

      return (
        auditTargetIds.includes(log.target_id ?? "") ||
        logPartnerId === partner.id ||
        logCompanyId === (company?.id ?? null)
      );
    });

    return {
      status: "ready" as const,
      partner,
      company,
      category,
      categories: (categoriesResult.data ?? []) as PartnerCategoryRow[],
      companies: (companiesResult.data ?? []) as PartnerCompanyRow[],
      metricsResult,
      reviewData,
      reviewCountResult,
      previewToken: previewTokenResult.error ? null : previewTokenResult.data,
      adCampaigns: couponManagementData[0],
      adCoupons: couponManagementData[1],
      selectedUsageBenefit,
      usageHistory,
      metricTimeseries,
      partnerAuditLogs,
      partnerRequestHistory,
    };
  } catch (error) {
    console.error("[admin-partner-detail] read model failed", error);
    return { status: "error" as const };
  }
}
