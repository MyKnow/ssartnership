"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import PartnerChangeRequestForm from "@/components/partner/PartnerChangeRequestForm";
import PartnerImageCarousel from "@/components/PartnerImageCarousel";
import ShareLinkButton from "@/components/ShareLinkButton";
import { buildPartnerChangeRequestDiffItems } from "@/components/partner-change-request-ui/buildDiffItems";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
} from "@/lib/partner-visibility";
import PartnerPendingRequestSection from "@/components/partner/partner-service-detail-view/PartnerPendingRequestSection";
import PartnerServiceContacts from "@/components/partner/partner-service-detail-view/PartnerServiceContacts";
import PartnerServiceSummaryCard from "@/components/partner/partner-service-detail-view/PartnerServiceSummaryCard";
import { getPartnerServiceVisualState } from "@/components/partner/partner-service-detail-view/helpers";
import type { PartnerServiceDetailViewProps } from "@/components/partner/partner-service-detail-view/types";

export default function PartnerServiceDetailViewContent({
  session,
  context,
  mode,
  errorMessage,
  successMessage,
  saveImmediateAction,
  createAction,
  cancelAction,
}: PartnerServiceDetailViewProps) {
  const visualState = getPartnerServiceVisualState(context);
  const viewHref = `/partner/services/${encodeURIComponent(context.partnerId)}`;
  const editHref = `${viewHref}?mode=edit`;
  const isEditMode = mode === "edit";
  const pendingRequest = context.pendingRequest;
  const pendingDiffItems = buildPartnerChangeRequestDiffItems(pendingRequest);
  const canCancelPendingRequest = pendingRequest?.requestedByAccountId === session.accountId;

  return (
    <div className="bg-background">
      <Container className="pb-16 pt-10">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button href="/partner" variant="ghost">
                포털로 돌아가기
              </Button>
              {!isEditMode ? (
                <ShareLinkButton targetType="partner" targetId={context.partnerId} />
              ) : null}
            </div>

            <Button href={mode === "edit" ? viewHref : editHref} variant="primary">
              <span className="inline-flex items-center gap-2">
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {mode === "edit" ? (
                    <>
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  ) : (
                    <>
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </>
                  )}
                </svg>
                {mode === "edit" ? "보기로 전환" : "수정 요청"}
              </span>
            </Button>
          </div>

          {isEditMode ? (
            <Card className="space-y-3 p-6 sm:p-8">
              <Badge className="bg-primary/10 text-primary">수정 요청</Badge>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {context.partnerName}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                메인 썸네일, 추가 이미지, 예약/문의 링크, 태그는 즉시 반영되고,
                브랜드명, 위치, 지도 URL, 기간, 이용 조건, 혜택, 적용 대상은 관리자
                승인 후 반영됩니다.
              </p>
            </Card>
          ) : (
            <>
              <Card className="space-y-4 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary/10 text-primary">브랜드</Badge>
                  <Badge className="bg-surface text-muted-foreground">
                    {context.companyName}
                  </Badge>
                  <Badge className={getPartnerVisibilityBadgeClass(context.visibility)}>
                    {getPartnerVisibilityLabel(context.visibility)}
                  </Badge>
                  {pendingRequest ? (
                    <Badge className="bg-amber-500/10 text-amber-700">
                      승인 대기 중
                    </Badge>
                  ) : null}
                </div>
              </Card>

              {pendingRequest ? (
                <PartnerPendingRequestSection
                  pendingRequest={pendingRequest}
                  pendingDiffItems={pendingDiffItems}
                />
              ) : null}

              <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
                <PartnerServiceSummaryCard
                  context={context}
                  badgeStyle={visualState.badgeStyle}
                  chipStyle={visualState.chipStyle}
                  thumbnailUrl={visualState.thumbnailUrl}
                  mapLink={visualState.mapLink}
                />

                <PartnerImageCarousel
                  key={`${context.partnerId}:${(context.images ?? []).join("|")}`}
                  className="order-2 xl:order-2"
                  images={context.images ?? []}
                  name={context.partnerName}
                  matchHeightSelector="[data-partner-detail-summary]"
                />
              </div>

              <PartnerServiceContacts
                isActive={visualState.isActive}
                contactCount={visualState.contactCount}
                partnerId={context.partnerId}
                reservationDisplay={visualState.reservationDisplay}
                inquiryDisplay={visualState.inquiryDisplay}
                reservationRawValue={visualState.normalizedLinks.reservationLink ?? ""}
                inquiryRawValue={visualState.normalizedLinks.inquiryLink ?? ""}
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
              saveImmediateAction={saveImmediateAction}
              createAction={createAction}
              cancelAction={cancelAction}
            />
          ) : null}
        </div>
      </Container>
    </div>
  );
}
