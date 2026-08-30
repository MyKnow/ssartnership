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
import type { PartnerAudienceKey } from "@/lib/partner-audience";
import type { CampusSlug } from "@/lib/campuses";
import type { PartnerBenefitActionType } from "@/lib/partner-benefit-action";
import type { PartnerBenefitVisibility } from "@/lib/partner-benefit-visibility";
import type { PartnerVisibility } from "@/lib/types";
import { isMissingPartnerPreviewExpiryColumnError } from "@/lib/partner-preview";
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

type AdminPartnerDetailBenefitRow = {
  id: string;
  title: string;
  max_apply_count: number | null;
  display_order?: number | null;
};

export type AdminPartnerDetailRow = {
  id: string;
  created_at: string;
  name: string;
  category_id?: string | null;
  company_id?: string | null;
  location?: string | null;
  detail_description?: string | null;
  campus_slugs?: CampusSlug[] | null;
  managed_campus_slugs?: string[] | null;
  thumbnail?: string | null;
  map_url?: string | null;
  benefit_action_type?: PartnerBenefitActionType | null;
  benefit_action_link?: string | null;
  reservation_link?: string | null;
  inquiry_link?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  conditions?: string[] | null;
  benefits?: string[] | null;
  partner_benefits?: AdminPartnerDetailBenefitRow[] | null;
  applies_to?: PartnerAudienceKey[] | null;
  images?: string[] | null;
  tags?: string[] | null;
  visibility: PartnerVisibility;
  benefit_visibility?: PartnerBenefitVisibility | null;
  benefit_verification_pin_hash?: string | null;
  benefit_verification_pin_salt?: string | null;
  company?: PartnerCompanyRow | PartnerCompanyRow[] | null;
  categories?: PartnerCategoryRow | PartnerCategoryRow[] | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

const PARTNER_DETAIL_OVERVIEW_SELECT =
  "id,created_at,name,company_id,managed_campus_slugs,period_start,period_end,benefits,visibility,partner_benefits(id,title,max_apply_count,display_order),company:partner_companies(id,name,slug),categories(id,key,label,color)";

const PARTNER_DETAIL_EDIT_SELECT =
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
 * Reads only the partner record and the options needed to render the first
 * actionable part of the detail route. Expensive operational panels are
 * intentionally kept out of this promise so the core view can stream first.
 */
export async function getAdminPartnerDetailCoreReadModel({
  partnerId,
  includeEditFields = false,
}: {
  partnerId: string;
  includeEditFields?: boolean;
}) {
  try {
    const supabase = getSupabaseAdminClient();
    const previewTokenPromise = (async () => {
      let previewTokenResult = await supabase
        .from("partner_preview_tokens")
        .select("created_at,expires_at,token_ciphertext,token_nonce,token_auth_tag,token_key_version")
        .eq("partner_id", partnerId)
        .maybeSingle();

      if (
        previewTokenResult.error &&
        isMissingPartnerPreviewExpiryColumnError(previewTokenResult.error.message)
      ) {
        previewTokenResult = await supabase
          .from("partner_preview_tokens")
          .select("created_at,token_ciphertext,token_nonce,token_auth_tag,token_key_version")
          .eq("partner_id", partnerId)
          .maybeSingle();
      }

      return previewTokenResult;
    })();
    const [partnerResult, previewTokenResult] = await Promise.all([
      supabase
        .from("partners")
        .select(
          includeEditFields
            ? PARTNER_DETAIL_EDIT_SELECT
            : PARTNER_DETAIL_OVERVIEW_SELECT,
        )
        .eq("id", partnerId)
        .maybeSingle(),
      previewTokenPromise,
    ]);

    if (partnerResult.error || previewTokenResult.error) {
      return { status: "error" as const };
    }
    const partner = partnerResult.data as unknown as AdminPartnerDetailRow | null;
    if (!partner) {
      return { status: "not_found" as const };
    }

    const company = normalizeRelation<PartnerCompanyRow>(
      partner.company,
    );
    const category = normalizeRelation<PartnerCategoryRow>(
      partner.categories,
    );
    return {
      status: "ready" as const,
      partner,
      company,
      category,
      previewToken: previewTokenResult.data,
    };
  } catch (error) {
    console.error("[admin-partner-detail] core read model failed", error);
    return { status: "error" as const };
  }
}

export type AdminPartnerDetailCoreReady = Extract<
  Awaited<ReturnType<typeof getAdminPartnerDetailCoreReadModel>>,
  { status: "ready" }
>;

export async function getAdminPartnerDetailOperationalReadModel({
  core,
  partnerId,
  managedCampusSlugs,
  reviewFilters,
  reviewPagination = { page: 1, pageSize: 12 },
  canReadCoupons,
  requestedUsageBenefit,
  usagePage,
}: {
  core: AdminPartnerDetailCoreReady;
  partnerId: string;
  managedCampusSlugs: readonly string[] | null;
  reviewFilters: AdminReviewFilters;
  reviewPagination?: {
    page: number;
    pageSize: number;
  };
  canReadCoupons: boolean;
  requestedUsageBenefit: string;
  usagePage: string;
}) {
  try {
    const supabase = getSupabaseAdminClient();
    const couponManagementDataPromise = canReadCoupons
      ? Promise.all([
          adPackageRepository.listAdminCampaigns(),
          adPackageRepository.listAdminCouponsForPartner(partnerId),
        ])
      : Promise.resolve<[AdCampaignWithStats[], AdCoupon[]]>([[], []]);
    const selectedUsageBenefit = (core.partner.benefits ?? []).includes(requestedUsageBenefit)
      ? requestedUsageBenefit
      : null;
    const auditTargetIds = Array.from(
      new Set(
        [core.partner.id, core.company?.id ?? core.partner.company_id ?? null].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    );
    const [
      metricsResult,
      reviewData,
      reviewCountResult,
      couponManagementData,
      usageHistory,
      metricTimeseries,
      partnerAuditLogsResult,
      partnerRequestHistory,
    ] = await Promise.all([
      getAdminPartnerMetrics([partnerId]),
      getAdminReviewPageData(reviewFilters, {
        includeCounts: false,
        managedCampusSlugs: managedCampusSlugs ? [...managedCampusSlugs] : null,
        ...reviewPagination,
      }),
      fetchPartnerReviewVisibilityCounts(supabase, partnerId),
      couponManagementDataPromise,
      partnerBenefitUsageRepository.listUsageHistory({
        partnerId,
        benefit: selectedUsageBenefit,
        page: parseUsagePage(usagePage),
        pageSize: 25,
      }),
      getPartnerMetricTimeseriesSnapshot(partnerId, core.partner.created_at),
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
        logPartnerId === core.partner.id ||
        logCompanyId === (core.company?.id ?? null)
      );
    });

    return {
      status: "ready" as const,
      metricsResult,
      reviewData,
      reviewCountResult,
      adCampaigns: couponManagementData[0],
      adCoupons: couponManagementData[1],
      selectedUsageBenefit,
      usageHistory,
      metricTimeseries,
      partnerAuditLogs,
      partnerRequestHistory,
    };
  } catch (error) {
    console.error("[admin-partner-detail] operational read model failed", error);
    return { status: "error" as const };
  }
}

export type AdminPartnerDetailOperationalReady = Extract<
  Awaited<ReturnType<typeof getAdminPartnerDetailOperationalReadModel>>,
  { status: "ready" }
>;

export type AdminPartnerDetailOperationalResult = Awaited<
  ReturnType<typeof getAdminPartnerDetailOperationalReadModel>
>;

/**
 * Backward-compatible aggregate read model for callers that still need the
 * complete detail payload in one promise.
 */
export async function getAdminPartnerDetailReadModel({
  partnerId,
  managedCampusSlugs,
  reviewFilters,
  reviewPagination,
  canReadCoupons,
  requestedUsageBenefit,
  usagePage,
}: {
  partnerId: string;
  managedCampusSlugs: readonly string[] | null;
  reviewFilters: AdminReviewFilters;
  reviewPagination?: {
    page: number;
    pageSize: number;
  };
  canReadCoupons: boolean;
  requestedUsageBenefit: string;
  usagePage: string;
}) {
  const core = await getAdminPartnerDetailCoreReadModel({
    partnerId,
    includeEditFields: true,
  });
  if (core.status !== "ready") {
    return core;
  }

  const operational = await getAdminPartnerDetailOperationalReadModel({
    core,
    partnerId,
    managedCampusSlugs,
    reviewFilters,
    reviewPagination,
    canReadCoupons,
    requestedUsageBenefit,
    usagePage,
  });
  if (operational.status !== "ready") {
    return operational;
  }

  return {
    ...core,
    ...operational,
  };
}
