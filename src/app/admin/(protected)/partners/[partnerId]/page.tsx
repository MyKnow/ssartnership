import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import AdminPartnerReviewManager from "@/components/admin/partner-detail/AdminPartnerReviewManager";
import AdminPartnerChangeHistory from "@/components/admin/partner-detail/AdminPartnerChangeHistory";
import AdminPartnerCouponManager from "@/components/admin/ad-packages/AdminPartnerCouponManager";
import AdminPartnerPreviewLinkPanel from "@/components/admin/AdminPartnerPreviewLinkPanel";
import PartnerCardForm from "@/components/PartnerCardForm";
import CategoryColorBadge from "@/components/ui/CategoryColorBadge";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import InlineMessage from "@/components/ui/InlineMessage";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import StatsRow from "@/components/ui/StatsRow";
import PartnerMetricTimeseriesPanel from "@/components/partner/PartnerMetricTimeseriesPanel";
import { deletePartner, updatePartner } from "@/app/admin/(protected)/actions";
import {
  createAdCouponAction,
  deleteAdCouponAction,
  duplicateAdCouponAction,
  updateAdCouponAction,
} from "@/app/admin/(protected)/_actions/ad-package-actions";
import {
  generatePartnerPreviewLink,
  removePartnerPreviewLink,
} from "@/app/admin/(protected)/_actions/partner-actions/preview";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import {
  assertAdminCanAccessManagedCampuses,
  getManagedCampusFilterValues,
} from "@/lib/admin-scope";
import { getAdminPartnerMetrics } from "@/lib/admin-partner-metrics";
import {
  getAdminReviewPageData,
  parseAdminReviewFilters,
  serializeAdminReviewFilters,
} from "@/lib/admin-reviews";
import { fetchPartnerReviewVisibilityCounts } from "@/lib/partner-counts";
import { partnerFormErrorMessages } from "@/lib/partner-form-errors";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
  getPartnerVisibilityState,
} from "@/lib/partner-visibility";
import { getPartnerMetricTimeseriesSnapshot } from "@/lib/partner-metric-timeseries";
import { fetchRequestSummariesForPartner } from "@/lib/partner-change-requests/summary";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { adPackageRepository } from "@/lib/repositories";
import type {
  AdCampaignWithStats,
  AdCoupon,
} from "@/lib/repositories/ad-package-repository";

export const dynamic = "force-dynamic";

const adminPartnerDetailErrorMessages: Record<string, string> = {
  ...partnerFormErrorMessages,
  ...adminActionErrorMessages,
};

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

export default async function AdminPartnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const adminSession = await requireAdminPermission("brands", "read", {
    path: "/admin/partners",
  });
  const { partnerId } = await params;
  const managedCampusFilter = getManagedCampusFilterValues(adminSession.account);
  const query = (await searchParams) ?? {};
  const detailPath = `/admin/partners/${partnerId}`;
  const partnerError = query.error
    ? adminPartnerDetailErrorMessages[String(query.error)] ?? null
    : null;
  const partnerSaved = query.success === "updated";
  const couponSuccessMessages: Record<string, string> = {
    "ad-coupon-created": "제휴처 쿠폰을 생성했습니다.",
    "ad-coupon-updated": "제휴처 쿠폰을 수정했습니다.",
    "ad-coupon-duplicated": "제휴처 쿠폰을 초안으로 복제했습니다.",
    "ad-coupon-deleted": "제휴처 쿠폰을 삭제했습니다.",
  };
  const couponSuccess = query.success
    ? couponSuccessMessages[String(query.success)] ?? null
    : null;
  const canReadCoupons = canAdmin(
    adminSession.account.permissions,
    "home_ads",
    "read",
  );
  const canCreateCoupons = canAdmin(
    adminSession.account.permissions,
    "home_ads",
    "create",
  );
  const canUpdateCoupons = canAdmin(
    adminSession.account.permissions,
    "home_ads",
    "update",
  );
  const canDeleteCoupons = canAdmin(
    adminSession.account.permissions,
    "home_ads",
    "delete",
  );

  const supabase = getSupabaseAdminClient();
  const couponManagementDataPromise = canReadCoupons
    ? Promise.all([
        adPackageRepository.listAdminCampaigns(),
        adPackageRepository.listAdminCouponsForPartner(partnerId),
      ])
    : Promise.resolve<[AdCampaignWithStats[], AdCoupon[]]>([[], []]);
  const reviewFilters = {
    ...parseAdminReviewFilters(query),
    partnerId,
    companyId: "",
  };
  let companiesQuery = supabase
    .from("partner_companies")
    .select("id,name,slug,description,is_active,managed_campus_slugs")
    .order("name", { ascending: true });
  if (managedCampusFilter) {
    companiesQuery = companiesQuery.overlaps("managed_campus_slugs", managedCampusFilter);
  }

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
      .select(
        "id,created_at,name,category_id,company_id,location,detail_description,campus_slugs,managed_campus_slugs,thumbnail,map_url,benefit_action_type,benefit_action_link,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,applies_to,images,tags,visibility,benefit_visibility,company:partner_companies(id,name,slug,description,is_active,managed_campus_slugs),categories(id,key,label,color,description)",
      )
      .eq("id", partnerId)
      .maybeSingle(),
    getAdminPartnerMetrics([partnerId]),
    getAdminReviewPageData(reviewFilters, {
      includeCounts: false,
      managedCampusSlugs: managedCampusFilter,
    }),
    fetchPartnerReviewVisibilityCounts(supabase, partnerId),
    supabase
      .from("partner_preview_tokens")
      .select("created_at")
      .eq("partner_id", partnerId)
      .maybeSingle(),
    couponManagementDataPromise,
  ]);

  const [adCampaigns, adCoupons] = couponManagementData;

  if (!partnerResult.data) {
    notFound();
  }

  const partner = partnerResult.data;
  try {
    assertAdminCanAccessManagedCampuses(
      adminSession.account,
      (partner as { managed_campus_slugs?: string[] | null }).managed_campus_slugs,
    );
  } catch {
    notFound();
  }
  const company = normalizeRelation<PartnerCompanyRow>(
    (partner as { company?: PartnerCompanyRow | PartnerCompanyRow[] | null }).company,
  );
  const category = normalizeRelation<PartnerCategoryRow>(
    (partner as {
      categories?: PartnerCategoryRow | PartnerCategoryRow[] | null;
    }).categories,
  );
  const metrics = metricsResult.metricsByPartnerId.get(partnerId);
  const visibilityState = getPartnerVisibilityState(
    partner.visibility,
    partner.period_start,
    partner.period_end,
  );
  const auditTargetIds = Array.from(
    new Set([
      partner.id,
      company?.id ?? partner.company_id ?? null,
    ].filter((value): value is string => Boolean(value))),
  );
  const auditActions = [
    "partner_create",
    "partner_update",
    "partner_delete",
    "partner_change_request_approve",
    "partner_change_request_reject",
    "partner_portal_immediate_update",
    "partner_portal_change_request_submit",
    "partner_portal_change_request_cancel",
    "partner_company_create",
    "partner_company_update",
    "partner_company_delete",
  ] as const;
  const [metricTimeseries, partnerAuditLogsResult, partnerRequestHistory] = await Promise.all([
    getPartnerMetricTimeseriesSnapshot(
      partnerId,
      partner.created_at,
    ),
    supabase
      .from("admin_audit_logs")
      .select("id,actor_id,action,target_type,target_id,properties,created_at")
      .in("action", auditActions as unknown as string[])
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
  const reviewQueryString = serializeAdminReviewFilters(reviewFilters);
  const returnTo = reviewQueryString ? `${detailPath}?${reviewQueryString}` : detailPath;
  const thumbnail = partner.thumbnail ?? partner.images?.[0] ?? null;
  const galleryImages = partner.thumbnail
    ? partner.images ?? []
    : (partner.images ?? []).slice(1);
  const totalReviewCount = reviewCountResult.errorMessage ? 0 : reviewCountResult.counts.totalCount;
  const visibleReviewCount = reviewCountResult.errorMessage ? 0 : reviewCountResult.counts.visibleCount;
  const hiddenReviewCount = reviewCountResult.errorMessage ? 0 : reviewCountResult.counts.hiddenCount;

  return (
    <AdminShell title={partner.name} backHref="/admin/partners" backLabel="제휴처">
      <section className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="Partner Detail"
          title={partner.name}
          description="제휴처 정보, 성과 집계, 리뷰 운영을 한 화면에서 관리합니다."
        />

        {partnerError ? <FormMessage variant="error">{partnerError}</FormMessage> : null}
        {couponSuccess ? <FormMessage variant="info">{couponSuccess}</FormMessage> : null}

        <Card tone="elevated">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={getPartnerVisibilityBadgeClass(visibilityState)}>
              {getPartnerVisibilityLabel(visibilityState)}
            </Badge>
            <CategoryColorBadge
              label={category?.label ?? "미분류"}
              color={category?.color}
            />
            <Badge>{company?.name ?? "회사 미연결"}</Badge>
          </div>

          <div className="mt-6">
            <StatsRow
              minItemWidth="11rem"
              items={[
                {
                  label: "즐겨찾기",
                  value: `${metrics?.favoriteCount ?? 0}`,
                  hint: "저장한 회원 수",
                },
                {
                  label: "PV",
                  value: `${metrics?.detailViews ?? 0}`,
                  hint: "상세 페이지 조회",
                },
                {
                  label: "UV",
                  value: `${metrics?.detailUv ?? 0}`,
                  hint: "고유 세션 기준 조회",
                },
                {
                  label: "CTA",
                  value: `${metrics?.totalClicks ?? 0}`,
                  hint: "전체 클릭 합계",
                },
                {
                  label: "카드 클릭",
                  value: `${metrics?.cardClicks ?? 0}`,
                  hint: "리스트 유입",
                },
                {
                  label: "지도 클릭",
                  value: `${metrics?.mapClicks ?? 0}`,
                  hint: "위치 탐색",
                },
                {
                  label: "예약 클릭",
                  value: `${metrics?.reservationClicks ?? 0}`,
                  hint: "예약 CTA",
                },
                {
                  label: "문의 클릭",
                  value: `${metrics?.inquiryClicks ?? 0}`,
                  hint: "문의 CTA",
                },
                {
                  label: "리뷰",
                  value: `${metrics?.reviewCount ?? 0}`,
                  hint: "삭제 제외",
                },
              ]}
            />
          </div>

          {metricsResult.warningMessage ? (
            <InlineMessage
              className="mt-6"
              tone="warning"
              title="제휴처 집계 일부를 불러오지 못했습니다."
              description={metricsResult.warningMessage}
            />
          ) : null}
        </Card>

        <PartnerMetricTimeseriesPanel data={metricTimeseries} />

        <AdminPartnerCouponManager
          partnerId={partner.id}
          partnerName={partner.name ?? "제휴처"}
          partnerPeriodEnd={partner.period_end}
          campaigns={adCampaigns.filter((campaign) => campaign.partnerId === partner.id)}
          coupons={adCoupons}
          createCouponAction={createAdCouponAction}
          updateCouponAction={updateAdCouponAction}
          duplicateCouponAction={duplicateAdCouponAction}
          deleteCouponAction={deleteAdCouponAction}
          canCreateCoupon={canCreateCoupons}
          canUpdateCoupon={canUpdateCoupons}
          canDeleteCoupon={canDeleteCoupons}
        />

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.72fr)] 2xl:items-start">
          <div className="grid min-w-0 gap-4">
            <AdminSectionHeading
              title="제휴처 수정"
              description="목록에서는 핵심 정보만 확인하고 이 상세 화면에서 제휴처 정보를 수정합니다."
            />
            <PartnerCardForm
              mode="edit"
              partner={{
                id: partner.id,
                name: partner.name ?? "",
                visibility: partner.visibility,
                benefitVisibility: partner.benefit_visibility ?? "public",
                location: partner.location ?? "",
                detailDescription: partner.detail_description ?? "",
                campusSlugs: partner.campus_slugs ?? [],
                mapUrl: partner.map_url ?? "",
                benefitActionType: partner.benefit_action_type ?? undefined,
                benefitActionLink: partner.benefit_action_link ?? undefined,
                reservationLink: partner.reservation_link ?? "",
                inquiryLink: partner.inquiry_link ?? "",
                period: {
                  start: partner.period_start ?? "",
                  end: partner.period_end ?? "",
                },
                conditions: partner.conditions ?? [],
                benefits: partner.benefits ?? [],
                appliesTo: partner.applies_to ?? [],
                thumbnail,
                images: galleryImages,
                tags: partner.tags ?? [],
                company: company
                  ? {
                      id: company.id,
                      name: company.name,
                      description: company.description ?? "",
                      contactName: "",
                      contactEmail: "",
                      contactPhone: "",
                    }
                  : null,
              }}
              categoryOptions={(categoriesResult.data ?? []).map((item) => ({
                id: item.id,
                label: item.label,
              }))}
              companyOptions={(companiesResult.data ?? []).map((item) => ({
                id: item.id,
                name: item.name,
                slug: item.slug,
              }))}
              categoryId={partner.category_id}
              formAction={updatePartner}
              deleteAction={deletePartner}
              submitLabel="제휴처 저장"
              clearDraftOnSuccess={partnerSaved}
              hiddenFields={[
                { name: "updateRedirectTo", value: detailPath },
                { name: "deleteRedirectTo", value: "/admin/partners" },
              ]}
            />
            <AdminPartnerPreviewLinkPanel
              partnerId={partner.id}
              hasActiveLink={Boolean(previewTokenResult.data?.created_at)}
              generateAction={generatePartnerPreviewLink}
              removeAction={removePartnerPreviewLink}
            />
          </div>

          <div className="2xl:sticky 2xl:top-24">
            <AdminPartnerChangeHistory
              logs={partnerAuditLogs}
              requests={partnerRequestHistory}
            />
          </div>
        </div>

        <Card tone="elevated">
          <AdminPartnerReviewManager
            reviews={reviewData.reviews}
            counts={{
              totalCount: totalReviewCount,
              visibleCount: visibleReviewCount,
              hiddenCount: hiddenReviewCount,
            }}
            filters={reviewFilters}
            basePath={detailPath}
            returnTo={returnTo}
          />
        </Card>
      </section>
    </AdminShell>
  );
}
