"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import SectionHeading from "@/components/ui/SectionHeading";
import Chip from "@/components/ui/Chip";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
import PartnerChangeRequestForm from "@/components/partner/PartnerChangeRequestForm";
import PartnerImageCarousel from "@/components/PartnerImageCarousel";
import ShareLinkButton from "@/components/ShareLinkButton";
import TrackedAnchor from "@/components/analytics/TrackedAnchor";
import ContactCopyRow from "@/components/ContactCopyRow";
import {
  getContactDisplay,
  getMapLink,
  normalizeReservationInquiry,
} from "@/lib/partner-links";
import { getCachedImageUrl } from "@/lib/image-cache";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
} from "@/lib/partner-visibility";
import { isWithinPeriod } from "@/lib/partner-utils";
import type { PartnerSession } from "@/lib/partner-session";
import type { PartnerChangeRequestContext } from "@/lib/partner-change-requests";

function withAlpha(color: string, alphaHex: string) {
  if (!color.startsWith("#") || color.length !== 7) {
    return color;
  }
  return `${color}${alphaHex}`;
}

function SummaryCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ListChips({
  values,
  emptyText,
}: {
  values: string[];
  emptyText: string;
}) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge key={value} className="bg-surface text-foreground">
          {value}
        </Badge>
      ))}
    </div>
  );
}

function SummaryRows({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-2xl border border-border bg-background/70 px-4 py-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {row.label}
          </p>
          <div className="mt-2 break-all text-sm leading-6 text-foreground">
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({
  label,
}: {
  label: string;
}) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
      {label}
    </p>
  );
}

export default function PartnerServiceDetailView({
  session,
  context,
  mode,
  errorMessage,
  successMessage,
  createAction,
  cancelAction,
}: {
  session: PartnerSession;
  context: PartnerChangeRequestContext;
  mode: "view" | "edit";
  errorMessage?: string | null;
  successMessage?: string | null;
  createAction: (formData: FormData) => void | Promise<void>;
  cancelAction: (formData: FormData) => void | Promise<void>;
}) {
  const isActive = isWithinPeriod(context.periodStart, context.periodEnd);
  const badgeStyle = context.categoryColor
    ? {
        backgroundColor: withAlpha(context.categoryColor, "1f"),
        color: context.categoryColor,
      }
    : undefined;
  const chipStyle = context.categoryColor
    ? {
        backgroundColor: withAlpha(context.categoryColor, "14"),
        borderColor: withAlpha(context.categoryColor, "55"),
        color: context.categoryColor,
      }
    : undefined;
  const thumbnailUrl = context.thumbnail ? getCachedImageUrl(context.thumbnail) : "";
  const mapLink = getMapLink(
    context.mapUrl ?? undefined,
    context.partnerLocation,
    context.partnerName,
  );
  const normalizedLinks = isActive
    ? normalizeReservationInquiry(
        context.reservationLink ?? undefined,
        context.inquiryLink ?? undefined,
      )
    : { reservationLink: "", inquiryLink: "" };
  const reservationDisplay = isActive
    ? getContactDisplay(normalizedLinks.reservationLink)
    : null;
  const inquiryDisplay = isActive
    ? getContactDisplay(normalizedLinks.inquiryLink)
    : null;
  const contactCount = [reservationDisplay, inquiryDisplay].filter(Boolean).length;
  const viewHref = `/partner/services/${encodeURIComponent(context.partnerId)}`;
  const editHref = `${viewHref}?mode=edit`;
  const isEditMode = mode === "edit";
  const canCancelPendingRequest =
    context.pendingRequest?.requestedByAccountId === session.accountId;

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
                브랜드 정보, 썸네일, 기타 이미지, 예약/문의 링크, 브랜드 제휴 기간,
                혜택, 이용 조건, 태그, 적용 대상을 요청할 수 있습니다. 승인되기 전까지는
                현재 값이 유지됩니다.
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
                  <Badge
                    className={getPartnerVisibilityBadgeClass(context.visibility)}
                  >
                    {getPartnerVisibilityLabel(context.visibility)}
                  </Badge>
                  {context.pendingRequest ? (
                    <Badge className="bg-amber-500/10 text-amber-700">
                      승인 대기 중
                    </Badge>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                    {context.companyName} - {context.partnerName}
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    브랜드 상세 정보를 확인할 수 있습니다. 연필 버튼을 누르면 같은
                    화면에서 수정 요청을 보낼 수 있습니다.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      브랜드명
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {context.partnerName}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      카테고리
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {context.categoryLabel}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      위치
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {context.partnerLocation}
                    </p>
                  </div>
                </div>
              </Card>

              {context.pendingRequest ? (
                <Card className="space-y-4 p-6 sm:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <Badge className="bg-amber-500/10 text-amber-700">
                        승인 대기 중
                      </Badge>
                      <p className="text-sm leading-6 text-muted-foreground">
                        제출된 요청은 관리자 승인 전까지 반영되지 않습니다.
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      요청 시각{" "}
                      {new Date(context.pendingRequest.createdAt).toLocaleString("ko-KR")}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <SummaryCard title="현재 브랜드 정보">
                      <SummaryRows
                        rows={[
                          {
                            label: "브랜드명",
                            value: context.pendingRequest.currentPartnerName,
                          },
                          {
                            label: "위치",
                            value: context.pendingRequest.currentPartnerLocation,
                          },
                          {
                            label: "지도 URL",
                            value: context.pendingRequest.currentMapUrl ?? "없음",
                          },
                        ]}
                      />
                    </SummaryCard>
                    <SummaryCard title="요청 브랜드 정보">
                      <SummaryRows
                        rows={[
                          {
                            label: "브랜드명",
                            value: context.pendingRequest.requestedPartnerName,
                          },
                          {
                            label: "위치",
                            value: context.pendingRequest.requestedPartnerLocation,
                          },
                          {
                            label: "지도 URL",
                            value: context.pendingRequest.requestedMapUrl ?? "없음",
                          },
                        ]}
                      />
                    </SummaryCard>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <SummaryCard title="현재 조건">
                      <ListChips
                        values={context.currentConditions}
                        emptyText="조건이 없습니다."
                      />
                    </SummaryCard>
                    <SummaryCard title="현재 혜택">
                      <ListChips
                        values={context.currentBenefits}
                        emptyText="혜택이 없습니다."
                      />
                    </SummaryCard>
                    <SummaryCard title="현재 적용 대상">
                      <PartnerAudienceChips appliesTo={context.currentAppliesTo} />
                    </SummaryCard>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <SummaryCard title="요청 조건">
                      <ListChips
                        values={context.pendingRequest.requestedConditions}
                        emptyText="조건이 없습니다."
                      />
                    </SummaryCard>
                    <SummaryCard title="요청 혜택">
                      <ListChips
                        values={context.pendingRequest.requestedBenefits}
                        emptyText="혜택이 없습니다."
                      />
                    </SummaryCard>
                    <SummaryCard title="현재 태그">
                      <ListChips values={context.tags} emptyText="태그가 없습니다." />
                    </SummaryCard>
                    <SummaryCard title="요청 태그">
                      <ListChips
                        values={context.pendingRequest.requestedTags}
                        emptyText="태그가 없습니다."
                      />
                    </SummaryCard>
                    <SummaryCard title="요청 적용 대상">
                      <PartnerAudienceChips
                        appliesTo={context.pendingRequest.requestedAppliesTo}
                      />
                    </SummaryCard>
                    <SummaryCard title="요청자">
                      <p className="text-sm text-foreground">
                        {context.pendingRequest.requestedByDisplayName ??
                          context.pendingRequest.requestedByLoginId ??
                          "미지정"}
                      </p>
                    </SummaryCard>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <SummaryCard title="현재 이미지 / 링크 / 기간">
                      <SummaryRows
                        rows={[
                          {
                            label: "썸네일",
                            value: context.pendingRequest.currentThumbnail
                              ? "등록됨"
                              : "없음",
                          },
                          {
                            label: "기타 이미지",
                            value:
                              context.pendingRequest.currentImages.length > 0
                                ? `${context.pendingRequest.currentImages.length}장`
                                : "없음",
                          },
                          {
                            label: "예약 링크",
                            value: context.pendingRequest.currentReservationLink ?? "없음",
                          },
                          {
                            label: "문의 링크",
                            value: context.pendingRequest.currentInquiryLink ?? "없음",
                          },
                          {
                            label: "기간",
                            value: `${context.pendingRequest.currentPeriodStart ?? "미정"} ~ ${context.pendingRequest.currentPeriodEnd ?? "미정"}`,
                          },
                        ]}
                      />
                    </SummaryCard>
                    <SummaryCard title="요청 이미지 / 링크 / 기간">
                      <SummaryRows
                        rows={[
                          {
                            label: "썸네일",
                            value: context.pendingRequest.requestedThumbnail
                              ? "등록됨"
                              : "없음",
                          },
                          {
                            label: "기타 이미지",
                            value:
                              context.pendingRequest.requestedImages.length > 0
                                ? `${context.pendingRequest.requestedImages.length}장`
                                : "없음",
                          },
                          {
                            label: "예약 링크",
                            value:
                              context.pendingRequest.requestedReservationLink ?? "없음",
                          },
                          {
                            label: "문의 링크",
                            value:
                              context.pendingRequest.requestedInquiryLink ?? "없음",
                          },
                          {
                            label: "기간",
                            value: `${context.pendingRequest.requestedPeriodStart ?? "미정"} ~ ${context.pendingRequest.requestedPeriodEnd ?? "미정"}`,
                          },
                        ]}
                      />
                    </SummaryCard>
                  </div>
                </Card>
              ) : null}

              <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
                <Card
                  className="order-1 relative overflow-hidden p-6 xl:order-1"
                  data-partner-detail-summary
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.08),_transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.08),_transparent_42%)]"
                  />
                  <div className="relative flex flex-col">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Badge
                        className={badgeStyle ? undefined : "bg-surface-muted text-foreground"}
                        style={badgeStyle}
                      >
                        {context.categoryLabel}
                      </Badge>
                      <span className="text-xs font-medium text-muted-foreground">
                        {context.periodStart ?? "미정"} ~ {context.periodEnd ?? "미정"}
                      </span>
                    </div>

                    {thumbnailUrl ? (
                      <div className="mt-4 w-full max-w-40 overflow-hidden rounded-3xl border border-border bg-surface-muted sm:max-w-48">
                        <div className="relative aspect-square w-full">
                          <Image
                            src={thumbnailUrl}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 40vw, 192px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      </div>
                    ) : null}

                    <h1 className="mt-4 text-3xl font-semibold text-foreground">
                      {context.partnerName}
                    </h1>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{context.partnerLocation}</span>
                      {mapLink ? (
                        <TrackedAnchor
                          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border text-foreground hover:border-strong"
                          href={mapLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          eventName="partner_map_click"
                          targetType="partner"
                          targetId={context.partnerId}
                          properties={{ source: "partner-portal" }}
                          aria-label="지도 보기"
                          title="지도 보기"
                        >
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
                            <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" />
                            <path d="M9 3v15" />
                            <path d="M15 6v15" />
                          </svg>
                        </TrackedAnchor>
                      ) : null}
                    </div>

                    <div className="mt-6 grid gap-5">
                      <div>
                        <SectionTitle label="이용 조건" />
                        <div className="mt-3 flex flex-wrap gap-2">
                          {context.currentConditions.map((condition) => (
                            <Badge
                              key={condition}
                              className="bg-surface-muted text-foreground dark:bg-slate-800 dark:text-slate-100"
                            >
                              {condition}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <SectionTitle label="혜택" />
                        <div className="mt-3 flex flex-wrap gap-2">
                          {context.currentBenefits.map((benefit) => (
                            <Badge
                              key={benefit}
                              className="bg-surface-muted text-foreground dark:bg-slate-800 dark:text-slate-100"
                            >
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <SectionTitle label="적용 대상" />
                        <PartnerAudienceChips
                          appliesTo={context.currentAppliesTo}
                          className="mt-3"
                        />
                      </div>

                      {context.tags && context.tags.length > 0 ? (
                        <div>
                          <SectionTitle label="태그" />
                          <div className="mt-3 flex flex-wrap gap-2">
                            {context.tags.map((tag) => (
                              <Chip key={tag} style={chipStyle}>
                                #{tag}
                              </Chip>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Card>

                <PartnerImageCarousel
                  key={`${context.partnerId}:${(context.images ?? []).join("|")}`}
                  className="order-2 xl:order-2"
                  images={context.images ?? []}
                  name={context.partnerName}
                />
              </div>

              {isActive ? (
                <div className={`grid gap-4 ${contactCount > 1 ? "xl:grid-cols-2" : ""}`}>
                  {reservationDisplay ? (
                    <Card className="w-full p-4 sm:p-5">
                      <SectionHeading title="예약" />
                      <ContactCopyRow
                        href={reservationDisplay.href}
                        label={reservationDisplay.label}
                        rawValue={normalizedLinks.reservationLink ?? ""}
                        eventName="reservation_click"
                        targetType="partner"
                        targetId={context.partnerId}
                      />
                    </Card>
                  ) : null}

                  {inquiryDisplay ? (
                    <Card className="w-full p-4 sm:p-5">
                      <SectionHeading title="문의" />
                      <ContactCopyRow
                        href={inquiryDisplay.href}
                        label={inquiryDisplay.label}
                        rawValue={normalizedLinks.inquiryLink ?? ""}
                        eventName="inquiry_click"
                        targetType="partner"
                        targetId={context.partnerId}
                      />
                    </Card>
                  ) : null}

                  {contactCount === 0 ? (
                    <Card className="w-full p-4 sm:p-5">
                      <SectionHeading title="예약/문의" />
                      <div className="mt-4 rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
                        현재 등록된 예약/문의 정보가 없습니다.
                      </div>
                    </Card>
                  ) : null}
                </div>
              ) : (
                <Card className="w-full p-4 sm:p-5">
                  <SectionHeading title="예약/문의" />
                  <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200">
                    현재 브랜드 제휴기간이 아니므로, 예약/문의를 할 수 없습니다.
                  </div>
                </Card>
              )}
            </>
          )}

          {mode === "edit" ? (
            <PartnerChangeRequestForm
              context={context}
              pendingRequest={context.pendingRequest}
              canCancelPendingRequest={canCancelPendingRequest}
              errorMessage={errorMessage}
              successMessage={successMessage}
              createAction={createAction}
              cancelAction={cancelAction}
            />
          ) : null}
        </div>
      </Container>
    </div>
  );
}
