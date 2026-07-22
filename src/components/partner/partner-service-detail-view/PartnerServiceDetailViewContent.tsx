"use client";

import { Eye } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import PartnerPendingButtonLink from "@/components/partner/PartnerPendingButtonLink";
import PartnerChangeRequestForm from "@/components/partner/PartnerChangeRequestForm";
import PartnerImageCarousel from "@/components/PartnerImageCarousel";
import PartnerReviewSection from "@/components/partner-reviews/PartnerReviewSection";
import ShareLinkButton from "@/components/ShareLinkButton";
import { buildPartnerChangeRequestDiffItems } from "@/components/partner-change-request-ui/buildDiffItems";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
} from "@/lib/partner-visibility";
import { getPartnerCompanyPlanDefinition } from "@/lib/partner-company-plans";
import PartnerServiceMetricsPanel from "@/components/partner/partner-service-detail-view/PartnerServiceMetricsPanel";
import PartnerPendingRequestSection from "@/components/partner/partner-service-detail-view/PartnerPendingRequestSection";
import PartnerServiceContacts from "@/components/partner/partner-service-detail-view/PartnerServiceContacts";
import PartnerServiceSummaryCard from "@/components/partner/partner-service-detail-view/PartnerServiceSummaryCard";
import PartnerRequestHistorySection from "@/components/partner/partner-service-detail-view/PartnerRequestHistorySection";
import PartnerMetricTimeseriesPanel from "@/components/partner/PartnerMetricTimeseriesPanel";
import { getPartnerServiceVisualState } from "@/components/partner/partner-service-detail-view/helpers";
import {
  getCompanyScopedPartnerServiceEditHref,
  getCompanyScopedPartnerServiceHref,
  getCompanyScopedPortalHref,
} from "@/lib/partner-portal-paths";
import type { PartnerServiceDetailViewProps } from "@/components/partner/partner-service-detail-view/types";
import PartnerCouponPanel from "@/components/partner/partner-service-detail-view/PartnerCouponPanel";
import PartnerBenefitUsageHistory from "@/components/partner/PartnerBenefitUsageHistory";

export default function PartnerServiceDetailViewContent({
  session,
  context,
  mode,
  errorMessage,
  successMessage,
  immediateSaveSucceeded,
  saveImmediateAction,
  createAction,
  cancelAction,
  reviewSummary,
  brandPlanTier,
  serviceMetrics,
  metricTimeseries,
  serviceMetricsWarningMessage,
  initialReviews,
  initialReviewSort,
  initialReviewOffset,
  initialReviewHasMore,
  coupons,
  partnerPeriodEnd,
  createCouponAction,
  uploadCouponCodesAction,
  benefitUsageHistory,
  selectedUsageBenefit,
  benefitUsageBaseHref,
}: PartnerServiceDetailViewProps) {
  const visualState = getPartnerServiceVisualState(context);
  const portalHref = getCompanyScopedPortalHref(context.companyId);
  const viewHref = getCompanyScopedPartnerServiceHref(context.companyId, context.partnerId);
  const editHref = getCompanyScopedPartnerServiceEditHref(context.companyId, context.partnerId);
  const publicHref = `/partners/${encodeURIComponent(context.partnerId)}`;
  const planHref = getCompanyScopedPortalHref(context.companyId, "plans");
  const isEditMode = mode === "edit";
  const pendingRequest = context.pendingRequest;
  const pendingDiffItems = buildPartnerChangeRequestDiffItems(pendingRequest);
  const canCancelPendingRequest = pendingRequest?.requestedByAccountId === session.accountId;
  const visibleRequestHistory = (context.requestHistory ?? []).filter(
    (request) => request.id !== pendingRequest?.id,
  );

  return (
    <div className="bg-background">
      <Container size="wide" className="pb-16 pt-6 lg:pt-8">
        <div className="w-full min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <PartnerPendingButtonLink
                href={portalHref}
                variant="ghost"
              >
                포털로 돌아가기
              </PartnerPendingButtonLink>
              {!isEditMode ? (
                <ShareLinkButton targetType="partner" targetId={context.partnerId} />
              ) : null}
            </div>

            {isEditMode ? (
              <PartnerPendingButtonLink
                href={viewHref}
                showSpinner
              >
                <span className="inline-flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  보기로 전환
                </span>
              </PartnerPendingButtonLink>
            ) : null}
          </div>

          {isEditMode ? (
              <Card className="space-y-3 p-6 sm:p-8">
                <Badge className="bg-primary/10 text-primary">수정 요청</Badge>
              <h1 className="line-clamp-2 text-ko-title text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {context.partnerName}
              </h1>
              <p className="max-w-3xl text-ko-pretty text-sm leading-6 text-muted-foreground">
                변경 방식이 다른 항목을 분리했습니다. 즉시 반영 항목은 저장 직후 공개 화면에
                적용되고, 승인 필요 항목은 관리자 검토 후 반영됩니다.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[1rem] border border-success/15 bg-success/10 p-4">
                  <p className="text-sm font-semibold text-success">즉시 반영</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    메인 썸네일, 추가 이미지, 혜택 이용/문의 링크, 태그
                  </p>
                </div>
                <div className="rounded-[1rem] border border-warning/20 bg-warning/10 p-4">
                  <p className="text-sm font-semibold text-warning">승인 필요</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    제휴처명, 위치, 지도 URL, 기간, 이용 조건, 혜택, 적용 대상
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <>
              <Card className="space-y-4 p-6 sm:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-primary/10 text-primary">제휴처</Badge>
                      <Badge className="bg-surface text-muted-foreground">
                        {context.companyName}
                      </Badge>
                      <Badge className={getPartnerVisibilityBadgeClass(context.visibility)}>
                        {getPartnerVisibilityLabel(context.visibility)}
                      </Badge>
                      <Badge variant={brandPlanTier === "boost" ? "primary" : brandPlanTier === "partner" ? "success" : "neutral"}>
                        {getPartnerCompanyPlanDefinition(brandPlanTier).label}
                      </Badge>
                      {pendingRequest ? (
                        <Badge className="bg-amber-500/10 text-amber-700">
                          수정 요청 승인 대기
                        </Badge>
                      ) : null}
                    </div>
                    <div>
                      <h1 className="line-clamp-2 text-ko-title text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                        {context.partnerName}
                      </h1>
                      <p className="mt-2 max-w-3xl text-ko-pretty text-sm leading-6 text-muted-foreground">
                        공개 상태, 플랜, 수정 요청 상태를 기준으로 제휴처 운영 신뢰도를 확인합니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PartnerPendingButtonLink href={publicHref} variant="secondary" showSpinner>
                      사용자 화면
                    </PartnerPendingButtonLink>
                    <PartnerPendingButtonLink
                      href={editHref}
                      showSpinner
                    >
                      수정 요청
                    </PartnerPendingButtonLink>
                  </div>
                </div>
              </Card>

              <PartnerServiceMetricsPanel
                metrics={serviceMetrics}
                planTier={brandPlanTier}
                reviewSummary={reviewSummary}
                warningMessage={serviceMetricsWarningMessage}
                planHref={planHref}
              />

              <PartnerMetricTimeseriesPanel data={metricTimeseries} />

              <PartnerBenefitUsageHistory
                benefits={context.currentBenefits}
                selectedBenefit={selectedUsageBenefit}
                history={benefitUsageHistory}
                createHref={({ benefit, page }) => {
                  const params = new URLSearchParams();
                  if (benefit) params.set("usageBenefit", benefit);
                  if (page && page > 1) params.set("usagePage", String(page));
                  const query = params.toString();
                  return `${benefitUsageBaseHref}${query ? `?${query}` : ""}`;
                }}
              />

              {pendingRequest ? (
                <PartnerPendingRequestSection
                  pendingRequest={pendingRequest}
                  pendingDiffItems={pendingDiffItems}
                />
              ) : null}

              {visibleRequestHistory.length > 0 ? (
                <PartnerRequestHistorySection requests={visibleRequestHistory} />
              ) : null}

              <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:items-start 2xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <PartnerServiceSummaryCard
                  context={context}
                  badgeStyle={visualState.badgeStyle}
                  chipStyle={visualState.chipStyle}
                  thumbnailUrl={visualState.thumbnailUrl}
                  mapLink={visualState.mapLink}
                  metrics={serviceMetrics}
                />

                <PartnerImageCarousel
                  key={`${context.partnerId}:${(context.images ?? []).join("|")}`}
                  className="order-2 xl:order-2"
                  images={context.images ?? []}
                  name={context.partnerName}
                  variant="main"
                  matchHeightSelector="[data-partner-detail-summary]"
                />
              </div>

              <PartnerServiceContacts
                isActive={visualState.isActive}
                contactCount={visualState.contactCount}
                partnerId={context.partnerId}
                reservationDisplay={visualState.reservationDisplay}
                inquiryDisplay={visualState.inquiryDisplay}
                reservationRawValue={
                  visualState.normalizedLinks.benefitActionLink ||
                  visualState.normalizedLinks.reservationLink ||
                  ""
                }
                inquiryRawValue={visualState.normalizedLinks.inquiryLink ?? ""}
              />
              <PartnerCouponPanel
                coupons={coupons}
                companyId={context.companyId}
                partnerId={context.partnerId}
                partnerPeriodEnd={partnerPeriodEnd}
                createAction={createCouponAction}
                uploadCodesAction={uploadCouponCodesAction}
              />
            </>
          )}

          {mode === "edit" ? (
            <PartnerChangeRequestForm
              context={context}
              pendingRequest={context.pendingRequest}
              canCancelPendingRequest={canCancelPendingRequest}
              errorMessage={errorMessage}
              successMessage={successMessage}
              clearImmediateDraftOnSuccess={immediateSaveSucceeded}
              saveImmediateAction={saveImmediateAction}
              createAction={createAction}
              cancelAction={cancelAction}
            />
          ) : null}

          <PartnerReviewSection
            partnerId={context.partnerId}
            canWriteReview={false}
            accessMode="partner"
            showWriteControls={false}
            title="리뷰"
            initialSummary={reviewSummary}
            initialReviews={initialReviews}
            initialSort={initialReviewSort}
            initialOffset={initialReviewOffset}
            initialHasMore={initialReviewHasMore}
          />
        </div>
      </Container>
    </div>
  );
}
