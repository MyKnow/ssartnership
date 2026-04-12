"use client";

import type { ReactElement, ReactNode } from "react";
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
import { cn } from "@/lib/cn";
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

function ListChips({
  values,
  emptyText,
  badgeClassName = "bg-surface text-foreground",
}: {
  values: string[];
  emptyText: string;
  badgeClassName?: string;
}) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge key={value} className={badgeClassName}>
          {value}
        </Badge>
      ))}
    </div>
  );
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

function formatRange(start: string | null, end: string | null) {
  return `${start ?? "미정"} ~ ${end ?? "미정"}`;
}

function DiffText({
  tone,
  children,
}: {
  tone: "current" | "requested";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "break-words text-sm font-medium leading-6",
        tone === "current"
          ? "text-rose-700 dark:text-rose-100"
          : "text-emerald-700 dark:text-emerald-100",
      )}
    >
      {children}
    </div>
  );
}

function DiffLink({
  tone,
  href,
}: {
  tone: "current" | "requested";
  href: string | null;
}) {
  if (!href) {
    return <DiffText tone={tone}>없음</DiffText>;
  }

  return (
    <a
      className={cn(
        "break-all text-sm font-medium leading-6 underline decoration-1 underline-offset-4",
        tone === "current"
          ? "text-rose-700 decoration-rose-300 hover:text-rose-600 dark:text-rose-100 dark:decoration-rose-400"
          : "text-emerald-700 decoration-emerald-300 hover:text-emerald-600 dark:text-emerald-100 dark:decoration-emerald-400",
      )}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {href}
    </a>
  );
}

function DiffPanel({
  tone,
  label,
  children,
}: {
  tone: "current" | "requested";
  label: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === "current"
      ? "border-rose-500/20 bg-rose-500/5"
      : "border-emerald-500/20 bg-emerald-500/5";
  const labelClass =
    tone === "current"
      ? "text-rose-700 dark:text-rose-200"
      : "text-emerald-700 dark:text-emerald-200";

  return (
    <div className={cn("rounded-2xl border p-4", toneClass)}>
      <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", labelClass)}>
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function DiffCard({
  label,
  current,
  requested,
}: {
  label: string;
  current: ReactNode;
  requested: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-background/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <Badge className="bg-primary/10 text-primary">변경됨</Badge>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <DiffPanel tone="current" label="현재">
          {current}
        </DiffPanel>
        <DiffPanel tone="requested" label="요청">
          {requested}
        </DiffPanel>
      </div>
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

type PendingDiffItem = {
  key: string;
  label: string;
  current: ReactElement;
  requested: ReactElement;
};

function getPendingDiffItems(
  pendingRequest: PartnerChangeRequestContext["pendingRequest"],
): PendingDiffItem[] {
  if (!pendingRequest) {
    return [];
  }

  return [
    pendingRequest.currentPartnerName !== pendingRequest.requestedPartnerName
      ? {
          key: "partnerName",
          label: "브랜드명",
          current: <DiffText tone="current">{pendingRequest.currentPartnerName}</DiffText>,
          requested: (
            <DiffText tone="requested">{pendingRequest.requestedPartnerName}</DiffText>
          ),
        }
      : null,
    pendingRequest.currentPartnerLocation !== pendingRequest.requestedPartnerLocation
      ? {
          key: "partnerLocation",
          label: "위치",
          current: (
            <DiffText tone="current">{pendingRequest.currentPartnerLocation}</DiffText>
          ),
          requested: (
            <DiffText tone="requested">
              {pendingRequest.requestedPartnerLocation}
            </DiffText>
          ),
        }
      : null,
    pendingRequest.currentMapUrl !== pendingRequest.requestedMapUrl
      ? {
          key: "mapUrl",
          label: "지도 URL",
          current: (
            <DiffLink tone="current" href={pendingRequest.currentMapUrl} />
          ),
          requested: (
            <DiffLink tone="requested" href={pendingRequest.requestedMapUrl} />
          ),
        }
      : null,
    !arraysEqual(pendingRequest.currentConditions, pendingRequest.requestedConditions)
      ? {
          key: "conditions",
          label: "이용 조건",
          current: (
            <ListChips
              values={pendingRequest.currentConditions}
              emptyText="조건이 없습니다."
              badgeClassName="border border-rose-500/15 bg-rose-500/10 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-100"
            />
          ),
          requested: (
            <ListChips
              values={pendingRequest.requestedConditions}
              emptyText="조건이 없습니다."
              badgeClassName="border border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-100"
            />
          ),
        }
      : null,
    !arraysEqual(pendingRequest.currentBenefits, pendingRequest.requestedBenefits)
      ? {
          key: "benefits",
          label: "혜택",
          current: (
            <ListChips
              values={pendingRequest.currentBenefits}
              emptyText="혜택이 없습니다."
              badgeClassName="border border-rose-500/15 bg-rose-500/10 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-100"
            />
          ),
          requested: (
            <ListChips
              values={pendingRequest.requestedBenefits}
              emptyText="혜택이 없습니다."
              badgeClassName="border border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-100"
            />
          ),
        }
      : null,
    !arraysEqual(pendingRequest.currentAppliesTo, pendingRequest.requestedAppliesTo)
      ? {
          key: "appliesTo",
          label: "적용 대상",
          current: (
            <PartnerAudienceChips
              appliesTo={pendingRequest.currentAppliesTo}
              badgeClassName="border border-rose-500/15 bg-rose-500/10 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-100"
            />
          ),
          requested: (
            <PartnerAudienceChips
              appliesTo={pendingRequest.requestedAppliesTo}
              badgeClassName="border border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-100"
            />
          ),
        }
      : null,
    pendingRequest.currentPeriodStart !== pendingRequest.requestedPeriodStart ||
    pendingRequest.currentPeriodEnd !== pendingRequest.requestedPeriodEnd
      ? {
          key: "period",
          label: "기간",
          current: (
            <DiffText tone="current">
              {formatRange(
                pendingRequest.currentPeriodStart,
                pendingRequest.currentPeriodEnd,
              )}
            </DiffText>
          ),
          requested: (
            <DiffText tone="requested">
              {formatRange(
                pendingRequest.requestedPeriodStart,
                pendingRequest.requestedPeriodEnd,
              )}
            </DiffText>
          ),
        }
      : null,
  ].filter((item): item is PendingDiffItem => Boolean(item));
}

export default function PartnerServiceDetailView({
  session,
  context,
  mode,
  errorMessage,
  successMessage,
  saveImmediateAction,
  createAction,
  cancelAction,
}: {
  session: PartnerSession;
  context: PartnerChangeRequestContext;
  mode: "view" | "edit";
  errorMessage?: string | null;
  successMessage?: string | null;
  saveImmediateAction: (formData: FormData) => void | Promise<void>;
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
  const pendingRequest = context.pendingRequest;
  const pendingDiffItems = getPendingDiffItems(pendingRequest);
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
              </Card>

              {pendingRequest ? (
                <Card className="space-y-5 p-6 sm:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <Badge className="bg-amber-500/10 text-amber-700">
                        승인 대기 중
                      </Badge>
                      <p className="text-sm leading-6 text-muted-foreground">
                        변경된 항목만 현재값과 요청값으로 비교합니다.
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      요청 시각 {new Date(pendingRequest.createdAt).toLocaleString("ko-KR")}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {pendingDiffItems.map((item) => (
                      <DiffCard
                        key={item.key}
                        label={item.label}
                        current={item.current}
                        requested={item.requested}
                      />
                    ))}
                  </div>

                  {pendingDiffItems.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
                      변경된 항목이 없습니다.
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                    요청자{" "}
                    <span className="font-medium text-foreground">
                      {pendingRequest.requestedByDisplayName ??
                        pendingRequest.requestedByLoginId ??
                        "미지정"}
                    </span>
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
