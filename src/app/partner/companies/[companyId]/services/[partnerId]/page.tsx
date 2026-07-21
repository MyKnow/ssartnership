import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PartnerServiceDetailView from "@/components/partner/PartnerServiceDetailView";
import {
  getPartnerChangeRequestContext,
  getPartnerChangeRequestErrorMessage,
} from "@/lib/partner-change-requests";
import type { PartnerChangeRequestErrorCode } from "@/lib/partner-change-request-errors";
import {
  getCompanyScopedPartnerServiceHref,
  getPartnerPasswordChangeHref,
} from "@/lib/partner-portal-paths";
import { assertPartnerPortalCompanyAccess } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { getPartnerMetricTimeseriesSnapshot } from "@/lib/partner-metric-timeseries";
import { getPartnerServiceMetrics } from "@/lib/partner-service-metrics";
import {
  canAccessPartnerMetric,
  getPartnerCompanyPlanDefinition,
} from "@/lib/partner-company-plans";
import { filterPartnerPortalMetricsForPlan } from "@/lib/partner-dashboard";
import {
  adPackageRepository,
  partnerBenefitUsageRepository,
  partnerReviewRepository,
} from "@/lib/repositories";
import { SITE_NAME } from "@/lib/site";
import {
  cancelPartnerChangeRequestAction,
  savePartnerImmediateChanges,
  submitPartnerChangeRequest,
} from "@/app/partner/services/[partnerId]/request/actions";
import { createPartnerCouponAction, uploadPartnerCouponCodesAction } from "./coupon-actions";

type PartnerServiceDetailPageSearchParams = {
  mode?: string | string[];
  error?: string | string[];
  success?: string | string[];
  usageBenefit?: string | string[];
  usagePage?: string | string[];
};

function readSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function parseUsagePage(value: string) {
  const page = Number.parseInt(value, 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function isPartnerChangeRequestErrorCode(
  value: string,
): value is PartnerChangeRequestErrorCode {
  return (
    value === "not_found" ||
    value === "forbidden" ||
    value === "pending_exists" ||
    value === "already_resolved" ||
    value === "no_changes" ||
    value === "invalid_request"
  );
}

export const metadata: Metadata = {
  title: `제휴처 상세 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PartnerCompanyServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; partnerId: string }>;
  searchParams?: Promise<PartnerServiceDetailPageSearchParams>;
}) {
  const { companyId, partnerId } = await params;
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect(getPartnerPasswordChangeHref(companyId));
  }

  const scope = await assertPartnerPortalCompanyAccess(session, companyId);
  if (!scope) {
    notFound();
  }

  const context = await getPartnerChangeRequestContext(
    [scope.id],
    partnerId,
    session.accountId,
  );
  if (!context || context.companyId !== scope.id) {
    notFound();
  }

  const canViewTimeseries = canAccessPartnerMetric(
    context.brandPlanTier,
    "timeseries",
  );
  const [reviewData, publicReviewSummary, serviceMetricsSnapshot, metricTimeseries] =
    await Promise.all([
      partnerReviewRepository.listPartnerReviews({
        partnerId,
        sort: "latest",
        offset: 0,
        limit: 10,
        includeHidden: true,
      }),
      partnerReviewRepository.getPartnerReviewSummary(partnerId),
      getPartnerServiceMetrics(partnerId),
      canViewTimeseries
        ? getPartnerMetricTimeseriesSnapshot(partnerId, context.partnerCreatedAt)
        : Promise.resolve({
            periodLabel: "",
            hour: {
              granularity: "hour" as const,
              labels: [],
              points: [],
              maxAverage: 0,
              hasData: false,
            },
            weekday: {
              granularity: "weekday" as const,
              labels: [],
              points: [],
              maxAverage: 0,
              hasData: false,
            },
            warningMessage: `${getPartnerCompanyPlanDefinition(context.brandPlanTier).label} 플랜에서는 시계열 상세 지표가 제공되지 않습니다.`,
          }),
    ]);
  const paramsData = (await searchParams) ?? {};
  const requestedUsageBenefit = readSearchParam(paramsData.usageBenefit);
  const selectedUsageBenefit = context.currentBenefits.includes(requestedUsageBenefit)
    ? requestedUsageBenefit
    : null;
  const benefitUsageHistory = await partnerBenefitUsageRepository.listUsageHistory({
    partnerId,
    benefit: selectedUsageBenefit,
    page: parseUsagePage(readSearchParam(paramsData.usagePage)),
    pageSize: 25,
  });
  const filteredServiceMetrics = filterPartnerPortalMetricsForPlan(
    serviceMetricsSnapshot.metrics,
    context.brandPlanTier,
  );
  const coupons = await adPackageRepository.listActiveCouponsForPartner(partnerId).catch(() => []);

  const mode = readSearchParam(paramsData.mode) === "edit" ? "edit" : "view";
  const errorCode = readSearchParam(paramsData.error);
  const successCode = readSearchParam(paramsData.success);
  const errorMessage = isPartnerChangeRequestErrorCode(errorCode)
    ? getPartnerChangeRequestErrorMessage(errorCode)
    : null;
  const successMessage =
    successCode === "saved"
      ? "메인 썸네일, 추가 이미지, 혜택 이용/문의 링크, 태그가 즉시 반영되었습니다."
      : successCode === "submitted"
        ? "변경 요청이 접수되었습니다. 관리자 승인 후 반영됩니다."
        : successCode === "cancelled"
          ? "변경 요청이 취소되었습니다."
          : null;

  return (
    <PartnerServiceDetailView
      session={session}
      context={context}
      mode={mode}
      errorMessage={errorMessage}
      successMessage={successMessage}
      immediateSaveSucceeded={successCode === "saved"}
      saveImmediateAction={savePartnerImmediateChanges}
      createAction={submitPartnerChangeRequest}
      cancelAction={cancelPartnerChangeRequestAction}
      reviewSummary={publicReviewSummary}
      brandPlanTier={context.brandPlanTier}
      serviceMetrics={filteredServiceMetrics}
      metricTimeseries={metricTimeseries}
      serviceMetricsWarningMessage={serviceMetricsSnapshot.warningMessage}
      initialReviews={reviewData.items}
      initialReviewSort="latest"
      initialReviewOffset={reviewData.nextOffset}
      initialReviewHasMore={reviewData.hasMore}
      coupons={coupons}
      partnerPeriodEnd={context.periodEnd}
      createCouponAction={createPartnerCouponAction}
      uploadCouponCodesAction={uploadPartnerCouponCodesAction}
      benefitUsageHistory={benefitUsageHistory}
      selectedUsageBenefit={selectedUsageBenefit}
      benefitUsageBaseHref={getCompanyScopedPartnerServiceHref(companyId, partnerId)}
    />
  );
}
