import AdminPartnerChangeHistory from "@/components/admin/partner-detail/AdminPartnerChangeHistory";
import AdminPartnerReviewManager from "@/components/admin/partner-detail/AdminPartnerReviewManager";
import AdminPartnerCouponManager from "@/components/admin/ad-packages/AdminPartnerCouponManager";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import PartnerMetricTimeseriesPanel from "@/components/partner/PartnerMetricTimeseriesPanel";
import PartnerBenefitUsageHistory from "@/components/partner/PartnerBenefitUsageHistory";
import CategoryColorBadge from "@/components/ui/CategoryColorBadge";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import InlineMessage from "@/components/ui/InlineMessage";
import StatsRow from "@/components/ui/StatsRow";
import Surface from "@/components/ui/Surface";
import {
  createAdCouponAction,
  deleteAdCouponAction,
  duplicateAdCouponAction,
  updateAdCouponAction,
} from "@/app/admin/(protected)/_actions/ad-package-actions";
import {
  createPartnerBenefitUsageAction,
  deleteBenefitUsageAction,
  updatePartnerBenefitUsageAction,
} from "@/app/admin/(protected)/_actions/partner-benefit-usage-actions";
import type { AdminReviewFilters } from "@/lib/admin-reviews";
import type {
  AdminPartnerDetailCoreReady,
  AdminPartnerDetailOperationalResult,
} from "@/lib/admin-partner-detail.server";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
  getPartnerVisibilityState,
} from "@/lib/partner-visibility";

type AsyncFormAction = (formData: FormData) => Promise<void>;

function partnerBenefits(partner: AdminPartnerDetailCoreReady["partner"]) {
  return (partner.partner_benefits ?? []).map(
    (benefit: {
      id: string;
      title: string;
      max_apply_count: number | null;
      display_order?: number | null;
    }) => ({
      id: benefit.id,
      title: benefit.title,
      maxApplyCount: benefit.max_apply_count,
      displayOrder: benefit.display_order ?? undefined,
    }),
  );
}

export function AdminPartnerDetailDeferredFallback({
  label,
}: {
  label: string;
}) {
  return (
    <Surface
      level="inset"
      padding="md"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm leading-6 text-muted-foreground">{label}</p>
    </Surface>
  );
}

export async function AdminPartnerDetailOperationalSections({
  operational,
  core,
  partnerId,
  detailPath,
  retryHref,
  partnerPeriodEnd,
  canCreateBenefitUsage,
  canUpdateBenefitUsage,
  canDeleteBenefitUsage,
  canCreateCoupons,
  canUpdateCoupons,
  canDeleteCoupons,
  couponError,
}: {
  operational: Promise<AdminPartnerDetailOperationalResult>;
  core: AdminPartnerDetailCoreReady;
  partnerId: string;
  detailPath: string;
  retryHref: string;
  partnerPeriodEnd?: string | null;
  canCreateBenefitUsage: boolean;
  canUpdateBenefitUsage: boolean;
  canDeleteBenefitUsage: boolean;
  canCreateCoupons: boolean;
  canUpdateCoupons: boolean;
  canDeleteCoupons: boolean;
  couponError: string | null;
}) {
  const detail = await operational;
  if (detail.status !== "ready") {
    return (
      <AdminStatePanel
        kind="error"
        title="제휴처 운영 정보를 불러오지 못했습니다."
        description="기본 정보는 표시하고 있습니다. 잠시 후 다시 확인해 주세요."
        action={
          <Button href={retryHref} variant="secondary">
            다시 확인
          </Button>
        }
      />
    );
  }

  const metrics = detail.metricsResult.metricsByPartnerId.get(partnerId);
  const visibilityState = getPartnerVisibilityState(
    core.partner.visibility,
    core.partner.period_start,
    core.partner.period_end,
  );
  const benefits = partnerBenefits(core.partner);
  const hasUsageActions =
    canCreateBenefitUsage && canUpdateBenefitUsage && canDeleteBenefitUsage;

  return (
    <>
      <Surface level="elevated" padding="lg">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={getPartnerVisibilityBadgeClass(visibilityState)}>
            {getPartnerVisibilityLabel(visibilityState)}
          </Badge>
          <CategoryColorBadge
            label={core.category?.label ?? "미분류"}
            color={core.category?.color}
          />
          <Badge>{core.company?.name ?? "회사 미연결"}</Badge>
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
                label: "CTA",
                value: `${metrics?.totalClicks ?? 0}`,
                hint: "전체 클릭 합계",
              },
              {
                label: "리뷰",
                value: `${metrics?.reviewCount ?? 0}`,
                hint: "삭제 제외",
              },
            ]}
          />
        </div>

        {detail.metricsResult.warningMessage ? (
          <InlineMessage
            className="mt-6"
            tone="warning"
            title="제휴처 집계 일부를 불러오지 못했습니다."
            description="일부 최신 수치는 잠시 표시되지 않을 수 있습니다. 잠시 후 다시 확인해 주세요."
          />
        ) : null}
      </Surface>

      <PartnerMetricTimeseriesPanel data={detail.metricTimeseries} />

      <PartnerBenefitUsageHistory
        benefits={benefits}
        selectedBenefit={detail.selectedUsageBenefit}
        history={detail.usageHistory}
        createHref={({ benefit, page }) => {
          const params = new URLSearchParams();
          if (benefit) params.set("usageBenefit", benefit);
          if (page && page > 1) params.set("usagePage", String(page));
          const queryString = params.toString();
          return `${detailPath}${queryString ? `?${queryString}` : ""}`;
        }}
        memberHref={(memberId) =>
          `/admin/members/${encodeURIComponent(memberId)}`
        }
        adminActions={
          hasUsageActions
            ? {
                partnerId,
                create: createPartnerBenefitUsageAction as AsyncFormAction,
                update: updatePartnerBenefitUsageAction as AsyncFormAction,
                delete: deleteBenefitUsageAction as AsyncFormAction,
              }
            : undefined
        }
      />

      <AdminPartnerCouponManager
        partnerId={partnerId}
        partnerName={core.partner.name ?? "제휴처"}
        partnerPeriodEnd={partnerPeriodEnd}
        campaigns={detail.adCampaigns}
        coupons={detail.adCoupons}
        createCouponAction={createAdCouponAction}
        updateCouponAction={updateAdCouponAction}
        duplicateCouponAction={duplicateAdCouponAction}
        deleteCouponAction={deleteAdCouponAction}
        errorMessage={couponError}
        canCreateCoupon={canCreateCoupons}
        canUpdateCoupon={canUpdateCoupons}
        canDeleteCoupon={canDeleteCoupons}
      />
    </>
  );
}

export async function AdminPartnerDetailHistorySections({
  operational,
}: {
  operational: Promise<AdminPartnerDetailOperationalResult>;
}) {
  const detail = await operational;
  if (detail.status !== "ready") {
    return null;
  }

  return (
    <AdminPartnerChangeHistory
      logs={detail.partnerAuditLogs}
      requests={detail.partnerRequestHistory}
    />
  );
}

export async function AdminPartnerDetailReviewSection({
  operational,
  detailPath,
  reviewFilters,
  returnTo,
  canUpdate = true,
  canDelete = true,
}: {
  operational: Promise<AdminPartnerDetailOperationalResult>;
  detailPath: string;
  reviewFilters: AdminReviewFilters;
  returnTo: string;
  canUpdate?: boolean;
  canDelete?: boolean;
}) {
  const detail = await operational;
  if (detail.status !== "ready") {
    return null;
  }

  const totalReviewCount = detail.reviewCountResult.errorMessage
    ? 0
    : detail.reviewCountResult.counts.totalCount;
  const visibleReviewCount = detail.reviewCountResult.errorMessage
    ? 0
    : detail.reviewCountResult.counts.visibleCount;
  const hiddenReviewCount = detail.reviewCountResult.errorMessage
    ? 0
    : detail.reviewCountResult.counts.hiddenCount;

  return (
    <Card tone="elevated">
      <AdminPartnerReviewManager
        reviews={detail.reviewData.reviews}
        pagination={detail.reviewData.pagination}
        counts={{
          totalCount: totalReviewCount,
          visibleCount: visibleReviewCount,
          hiddenCount: hiddenReviewCount,
        }}
        filters={reviewFilters}
        basePath={detailPath}
        returnTo={returnTo}
        canUpdate={canUpdate}
        canDelete={canDelete}
      />
    </Card>
  );
}
