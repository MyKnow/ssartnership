"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  ReceiptText,
} from "lucide-react";
import PartnerPlanUpgradeForm from "@/components/partner/PartnerPlanUpgradeForm";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SubmitButton from "@/components/ui/SubmitButton";
import { cancelPartnerPlanUpgradeRequestAction } from "@/app/partner/plans/actions";
import { calculatePartnerPlanUpgradeCharge } from "@/lib/partner-billing";
import type { PartnerBillingProfileRecord } from "@/lib/partner-billing-profiles";
import type { PartnerBankTransferAccount } from "@/lib/partner-billing-config";
import {
  getPartnerCompanyPlanDefinition,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import { getPartnerPortalMetricAccessItems } from "@/lib/partner-portal-metric-access";
import type { PartnerPlanPortalData } from "@/lib/partner-plan-service";
import {
  PARTNER_PLAN_FILTERS,
  formatPartnerPlanCurrency,
  formatPartnerPlanMonthlyPrice,
  getPartnerPlanChannelLabel,
  getPartnerPlanExpiryStatus,
  getPartnerPlanFilterLabel,
  getPartnerPlanUpgradeOptions,
  matchesPartnerPlanFilter,
  type PartnerPlanFilter,
} from "@/lib/partner-plan-ui";
import { cn } from "@/lib/cn";

function formatDateTime(value?: string | null) {
  return value ? formatKoreanDateTimeToMinute(value) : "없음";
}

function getPeriodLines({
  startedAt,
  expiresAt,
  emptyLabel,
}: {
  startedAt?: string | null;
  expiresAt?: string | null;
  emptyLabel: string;
}) {
  if (!startedAt && !expiresAt) {
    return [emptyLabel];
  }
  return [
    `시작일 ${startedAt ? formatDateTime(startedAt) : "없음"}`,
    `만료일 ${expiresAt ? formatDateTime(expiresAt) : "없음"}`,
  ];
}

function getDaysUntil(value: string | null | undefined, nowIso: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  const now = new Date(nowIso);
  if (Number.isNaN(date.getTime()) || Number.isNaN(now.getTime())) {
    return null;
  }
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

function getVisibilityLabel(value: string) {
  switch (value) {
    case "public":
    case "visible":
      return "공개";
    case "confidential":
      return "검토용";
    case "private":
    case "hidden":
      return "비공개";
    default:
      return value;
  }
}

function PlanBadge({ tier }: { tier: PartnerCompanyPlanTier }) {
  const definition = getPartnerCompanyPlanDefinition(tier);
  return (
    <Badge
      variant={tier === "boost" ? "primary" : tier === "partner" ? "success" : "neutral"}
    >
      {definition.label}
    </Badge>
  );
}

function getRequestStatusLabel(status: string) {
  switch (status) {
    case "approved":
      return "승인";
    case "rejected":
      return "반려";
    case "cancelled":
      return "취소";
    default:
      return "대기";
  }
}

function RequestStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={
        status === "pending"
          ? "warning"
          : status === "approved"
            ? "success"
            : status === "rejected"
              ? "danger"
              : "neutral"
      }
    >
      {getRequestStatusLabel(status)}
    </Badge>
  );
}

export default function PartnerPlanBrandList({
  data,
  companyId,
  bankTransferAccount,
  billingProfiles,
  nowIso,
}: {
  data: PartnerPlanPortalData;
  companyId: string;
  bankTransferAccount: PartnerBankTransferAccount;
  billingProfiles: PartnerBillingProfileRecord[];
  nowIso: string;
}) {
  const [selectedFilter, setSelectedFilter] = useState<PartnerPlanFilter>("all");
  const [expandedBrandId, setExpandedBrandId] = useState<string | null>(null);

  const brandItems = useMemo(
    () =>
      data.brands.map((brand) => {
        const planDefinition = getPartnerCompanyPlanDefinition(brand.planTier);
        const pendingRequest = data.requests.find(
          (request) => request.partnerId === brand.id && request.status === "pending",
        );
        const upgradeOptions = getPartnerPlanUpgradeOptions(brand.planTier).map(
          (definition) => ({
            ...definition,
            billingCharge: calculatePartnerPlanUpgradeCharge({
              currentPlanTier: brand.planTier,
              requestedPlanTier: definition.tier,
              effectiveAt: nowIso,
              currentPeriodStart: brand.planStartedAt,
              currentPeriodEnd: brand.planExpiresAt,
            }),
          }),
        );
        const metricAccessItems = getPartnerPortalMetricAccessItems(brand.planTier);
        const accessibleMetricCount = metricAccessItems.filter(
          (item) => !item.locked,
        ).length;
        const daysUntil = getDaysUntil(brand.planExpiresAt, nowIso);

        return {
          brand,
          daysUntil,
          expiryStatus: getPartnerPlanExpiryStatus(brand.planTier, daysUntil),
          planDefinition,
          pendingRequest,
          upgradeOptions,
          metricAccessItems,
          accessibleMetricCount,
          hasPendingRequest: Boolean(pendingRequest),
        };
      }),
    [data.brands, data.requests, nowIso],
  );

  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        PARTNER_PLAN_FILTERS.map((filter) => [
          filter,
          brandItems.filter((item) =>
            matchesPartnerPlanFilter(
              {
                planTier: item.brand.planTier,
                hasPendingRequest: item.hasPendingRequest,
                daysUntil: item.daysUntil,
              },
              filter,
            ),
          ).length,
        ]),
      ) as Record<PartnerPlanFilter, number>,
    [brandItems],
  );

  const visibleItems = brandItems.filter((item) =>
    matchesPartnerPlanFilter(
      {
        planTier: item.brand.planTier,
        hasPendingRequest: item.hasPendingRequest,
        daysUntil: item.daysUntil,
      },
      selectedFilter,
    ),
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex max-w-full min-w-0 flex-col gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-2 sm:flex-row sm:items-center sm:justify-between">
        <div
          aria-label="브랜드 플랜 필터"
          className="flex max-w-full min-w-0 gap-1 overflow-x-auto"
        >
          {PARTNER_PLAN_FILTERS.map((filter) => {
            const selected = selectedFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setSelectedFilter(filter);
                }}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[0.85rem] px-3 text-sm font-semibold transition-surface",
                  selected
                    ? "bg-primary text-primary-foreground shadow-flat"
                    : "text-muted-foreground hover:bg-surface-control hover:text-foreground",
                )}
              >
                {getPartnerPlanFilterLabel(filter)}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px]",
                    selected ? "bg-white/15 text-primary-foreground" : "bg-surface-control",
                  )}
                >
                  {filterCounts[filter]}
                </span>
              </button>
            );
          })}
        </div>
        <p className="px-2 text-xs font-semibold text-muted-foreground">
          {visibleItems.length.toLocaleString("ko-KR")}개 브랜드
        </p>
      </div>

      {visibleItems.length === 0 ? (
        <Card tone="muted" padding="md">
          <EmptyState
            title="조건에 맞는 브랜드가 없습니다."
            description="다른 필터를 선택해 브랜드 플랜 상태를 확인해 주세요."
          />
        </Card>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          {visibleItems.map((item) => {
            const {
              brand,
              planDefinition,
              pendingRequest,
              upgradeOptions,
              metricAccessItems,
              accessibleMetricCount,
              expiryStatus,
            } = item;
            const expanded = expandedBrandId === brand.id;
            const periodLabel = brand.planTier === "basic" ? "제휴 기간" : "플랜 기간";
            const periodLines = getPeriodLines({
              startedAt: brand.planStartedAt,
              expiresAt: brand.planExpiresAt,
              emptyLabel: `${periodLabel} 없음`,
            });

            return (
              <Card key={brand.id} tone="default" padding="none" className="overflow-hidden">
                <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <PlanBadge tier={brand.planTier} />
                        <Badge variant="neutral">{brand.companyName}</Badge>
                        <Badge variant="neutral">{getVisibilityLabel(brand.visibility)}</Badge>
                        <Badge variant={expiryStatus.tone}>{expiryStatus.label}</Badge>
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-foreground">
                          {brand.name}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          플랜 변경 {formatDateTime(brand.planUpdatedAt)}
                        </p>
                      </div>
                    </div>

                    {pendingRequest ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-[0.95rem] border border-warning/25 bg-warning/10 px-3 py-2 text-sm">
                        <Clock3 className="h-4 w-4 text-warning" />
                        <span className="font-semibold text-foreground">승인 대기</span>
                        <PlanBadge tier={pendingRequest.currentPlanTier} />
                        <span className="text-muted-foreground">→</span>
                        <PlanBadge tier={pendingRequest.requestedPlanTier} />
                        <span className="font-semibold text-foreground">
                          {formatPartnerPlanCurrency(pendingRequest.paymentAmountKrw)}
                        </span>
                      </div>
                    ) : upgradeOptions.length > 0 ? (
                      <Button
                        variant={expanded ? "secondary" : "primary"}
                        onClick={() => {
                          setExpandedBrandId(expanded ? null : brand.id);
                        }}
                        ariaPressed={expanded}
                        className="w-full sm:w-auto"
                      >
                        <ReceiptText className="h-4 w-4" />
                        {expanded ? "요청 닫기" : "업그레이드 요청"}
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            expanded ? "rotate-180" : null,
                          )}
                        />
                      </Button>
                    ) : (
                      <Badge variant="success" className="self-start">
                        최상위 플랜
                      </Badge>
                    )}
                  </div>

                  <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="min-w-0 rounded-[0.9rem] border border-border/70 bg-surface-inset p-3">
                      <p className="text-xs font-semibold text-muted-foreground">
                        현재 플랜
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {planDefinition.label}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatPartnerPlanMonthlyPrice(brand.planTier)}
                      </p>
                    </div>
                    <div className="min-w-0 rounded-[0.9rem] border border-border/70 bg-surface-inset p-3">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {periodLabel}
                      </p>
                      <div className="mt-2 grid gap-1 text-sm leading-6 text-foreground">
                        {periodLines.map((line) => (
                          <p key={line} className="truncate">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-[0.9rem] border border-border/70 bg-surface-inset p-3">
                      <p className="text-xs font-semibold text-muted-foreground">
                        이용 가능 지표
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {accessibleMetricCount}/{metricAccessItems.length}개
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        플랜 기준 지표 범위
                      </p>
                    </div>
                    <div className="min-w-0 rounded-[0.9rem] border border-border/70 bg-surface-inset p-3">
                      <p className="text-xs font-semibold text-muted-foreground">
                        광고/운영 채널
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {planDefinition.allowedAdChannels.map((channel) => (
                          <span
                            key={channel}
                            className="rounded-full border border-border bg-surface-control px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                          >
                            {getPartnerPlanChannelLabel(channel)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {pendingRequest ? (
                    <div className="grid gap-3 rounded-[1rem] border border-warning/25 bg-warning/10 p-4">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] border border-warning/20 bg-warning/10 text-warning">
                          <Clock3 className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            입금 확인 후 관리자가 플랜을 반영합니다.
                          </p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            납부기한{" "}
                            {pendingRequest.billingInvoice
                              ? formatDateTime(pendingRequest.billingInvoice.dueAt)
                              : "확인 중"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <RequestStatusBadge
                          status={
                            pendingRequest.billingInvoice?.invoiceStatus === "paid"
                              ? "approved"
                              : "pending"
                          }
                        />
                        <span className="font-semibold text-foreground">
                          {formatPartnerPlanCurrency(pendingRequest.paymentAmountKrw)}
                        </span>
                      </div>
                      <form action={cancelPartnerPlanUpgradeRequestAction}>
                        <input type="hidden" name="companyId" value={companyId} />
                        <input type="hidden" name="requestId" value={pendingRequest.id} />
                        <SubmitButton
                          variant="secondary"
                          pendingText="취소 중"
                          className="w-full sm:w-auto"
                        >
                          요청 취소
                        </SubmitButton>
                      </form>
                    </div>
                  ) : upgradeOptions.length === 0 ? (
                    <div className="flex items-start gap-3 rounded-[1rem] border border-success/15 bg-success/10 p-4">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] border border-success/15 bg-success/10 text-success">
                        <CheckCircle2 className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-success">
                          최상위 플랜 이용 중
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          홈 배너, 앱 푸시/MM, 일반 애드배너와 상세 지표를 모두 이용할 수 있습니다.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <div className="flex flex-wrap gap-2">
                        {upgradeOptions.map((definition) => (
                          <span
                            key={definition.tier}
                            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-inset px-3 py-1 text-xs font-semibold text-muted-foreground"
                          >
                            {definition.label}
                            <span className="text-foreground">
                              {formatPartnerPlanMonthlyPrice(definition.tier)}
                            </span>
                            <span className="text-primary">
                              이번 결제{" "}
                              {formatPartnerPlanCurrency(
                                definition.billingCharge.totalAmountKrw,
                              )}
                            </span>
                          </span>
                        ))}
                      </div>
                      {expanded ? (
                        <PartnerPlanUpgradeForm
                          companyId={companyId}
                          partnerId={brand.id}
                          currentPlanTier={brand.planTier}
                          upgradeOptions={upgradeOptions}
                          bankTransferAccount={bankTransferAccount}
                          billingProfiles={billingProfiles}
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
