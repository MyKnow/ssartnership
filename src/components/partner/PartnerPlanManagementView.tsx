import { CalendarClock, CheckCircle2, Clock3 } from "lucide-react";
import PartnerPlanUpgradeForm from "@/components/partner/PartnerPlanUpgradeForm";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import {
  PARTNER_COMPANY_PLAN_DEFINITIONS,
  getPartnerCompanyPlanDefinition,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";
import { calculatePartnerPlanUpgradeCharge } from "@/lib/partner-billing";
import type { PartnerBankTransferAccount } from "@/lib/partner-billing-config";
import { getPartnerPortalMetricAccessItems } from "@/lib/partner-portal-metric-access";
import type { PartnerPlanPortalData } from "@/lib/partner-plan-service";
import {
  formatPartnerPlanCurrency,
  formatPartnerPlanMonthlyPrice,
  getPartnerPlanChannelLabel,
  getPartnerPlanProgressLabel,
  getPartnerPlanUpgradeOptions,
} from "@/lib/partner-plan-ui";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import {
  cancelPartnerPlanUpgradeRequestAction,
} from "@/app/partner/plans/actions";

function formatDateTime(value?: string | null) {
  return value ? formatKoreanDateTimeToMinute(value) : "없음";
}

function getDaysUntil(value?: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
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

export default function PartnerPlanManagementView({
  data,
  companyId,
  bankTransferAccount,
}: {
  data: PartnerPlanPortalData;
  companyId: string;
  bankTransferAccount: PartnerBankTransferAccount;
}) {
  if (data.brands.length === 0) {
    return (
      <EmptyState
        title="연결된 브랜드가 없습니다."
        description="관리자에서 담당 계정과 브랜드가 속한 파트너사를 먼저 연결해야 합니다."
      />
    );
  }

  const pendingRequestCount = data.requests.filter(
    (request) => request.status === "pending",
  ).length;
  const expiringBrandCount = data.brands.filter((brand) => {
    const daysUntil = getDaysUntil(brand.planExpiresAt);
    return daysUntil !== null && daysUntil >= 0 && daysUntil <= 30;
  }).length;
  const brandCountByTier = Object.fromEntries(
    PARTNER_COMPANY_PLAN_DEFINITIONS.map((definition) => [
      definition.tier,
      data.brands.filter((brand) => brand.planTier === definition.tier).length,
    ]),
  ) as Record<PartnerCompanyPlanTier, number>;
  const nowIso = new Date().toISOString();

  return (
    <div className="grid gap-6">
      <Card tone="default" padding="md" className="grid gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="ui-kicker">플랜 운영 요약</p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">
              브랜드별 현재 플랜과 요청 상태를 한 번에 확인합니다.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={pendingRequestCount > 0 ? "warning" : "neutral"}>
              승인 대기 {pendingRequestCount.toLocaleString("ko-KR")}건
            </Badge>
            <Badge variant={expiringBrandCount > 0 ? "warning" : "neutral"}>
              만료 임박 {expiringBrandCount.toLocaleString("ko-KR")}건
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {PARTNER_COMPANY_PLAN_DEFINITIONS.map((definition) => (
            <div
              key={definition.tier}
              className="rounded-[1rem] border border-border/70 bg-surface-inset p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PlanBadge tier={definition.tier} />
                    <span className="text-xs font-semibold text-muted-foreground">
                      {getPartnerPlanProgressLabel(definition.tier)}
                    </span>
                  </div>
                  <p className="mt-3 text-lg font-semibold text-foreground">
                    {formatPartnerPlanMonthlyPrice(definition.tier)}
                  </p>
                </div>
                <span className="text-2xl font-semibold text-foreground">
                  {brandCountByTier[definition.tier]}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {definition.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {definition.allowedAdChannels.map((channel) => (
                  <span
                    key={channel}
                    className="rounded-full border border-border bg-surface-control px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                  >
                    {getPartnerPlanChannelLabel(channel)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <section className="grid gap-4">
        <SectionHeading
          title="브랜드별 플랜"
          description="브랜드마다 현재 플랜, 이용 가능 기능, 업그레이드 요청 상태를 확인합니다."
        />
        <div className="grid gap-4">
          {data.brands.map((brand) => {
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
            const daysUntil = getDaysUntil(brand.planExpiresAt);
            const planWindowTone =
              daysUntil !== null && daysUntil >= 0 && daysUntil <= 30
                ? "warning"
                : "neutral";

            return (
              <Card key={brand.id} tone="default" padding="none" className="overflow-hidden">
                <div className="grid gap-5 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <PlanBadge tier={brand.planTier} />
                        <Badge variant="neutral">{brand.companyName}</Badge>
                        <Badge variant="neutral">
                          {getVisibilityLabel(brand.visibility)}
                        </Badge>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-foreground">
                          {brand.name}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          플랜 변경 {formatDateTime(brand.planUpdatedAt)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={planWindowTone}>
                      {daysUntil === null
                        ? "만료일 없음"
                        : daysUntil < 0
                          ? "플랜 만료"
                          : `D-${daysUntil}`}
                    </Badge>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="grid gap-4 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] border border-primary/15 bg-primary-soft text-primary">
                          <CalendarClock className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            현재 플랜
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-foreground">
                            {planDefinition.label}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatPartnerPlanMonthlyPrice(brand.planTier)}
                          </p>
                        </div>
                      </div>

                      <dl className="grid gap-3 text-sm">
                        <div>
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">
                            이용 기간
                          </dt>
                          <dd className="mt-1 leading-6 text-foreground">
                            {formatDateTime(brand.planStartedAt)} -{" "}
                            {formatDateTime(brand.planExpiresAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">
                            이용 가능 지표
                          </dt>
                          <dd className="mt-1 text-foreground">
                            {accessibleMetricCount}/{metricAccessItems.length}개 지표
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">
                            광고/운영 채널
                          </dt>
                          <dd className="mt-2 flex flex-wrap gap-1.5">
                            {planDefinition.allowedAdChannels.map((channel) => (
                              <span
                                key={channel}
                                className="rounded-full border border-border bg-surface-control px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                              >
                                {getPartnerPlanChannelLabel(channel)}
                              </span>
                            ))}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {pendingRequest ? (
                      <div className="grid gap-4 rounded-[1rem] border border-warning/25 bg-warning/10 p-4">
                        <div className="flex items-start gap-3">
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] border border-warning/20 bg-warning/10 text-warning">
                            <Clock3 className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              승인 대기 중
                            </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              계좌이체 입금 확인 후 관리자가 플랜을 반영합니다.
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <PlanBadge tier={pendingRequest.currentPlanTier} />
                          <span className="text-muted-foreground">→</span>
                          <PlanBadge tier={pendingRequest.requestedPlanTier} />
                          <span className="font-semibold text-foreground">
                            {formatPartnerPlanCurrency(pendingRequest.paymentAmountKrw)}
                          </span>
                          {pendingRequest.billingInvoice ? (
                            <>
                              <RequestStatusBadge
                                status={
                                  pendingRequest.billingInvoice.invoiceStatus === "paid"
                                    ? "approved"
                                    : "pending"
                                }
                              />
                              <span className="text-xs text-muted-foreground">
                                납부기한 {formatDateTime(pendingRequest.billingInvoice.dueAt)}
                              </span>
                            </>
                          ) : null}
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
                      <div className="grid content-start gap-3 rounded-[1rem] border border-success/15 bg-success/10 p-4">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[0.9rem] border border-success/15 bg-success/10 text-success">
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
                      <PartnerPlanUpgradeForm
                        companyId={companyId}
                        partnerId={brand.id}
                        currentPlanTier={brand.planTier}
                        upgradeOptions={upgradeOptions}
                        bankTransferAccount={bankTransferAccount}
                      />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4">
        <SectionHeading title="요청 이력" description="최근 업그레이드 요청 처리 상태입니다." />
        {data.requests.length === 0 ? (
          <Card tone="muted" padding="md">
            <EmptyState
              title="요청 이력이 없습니다."
              description="업그레이드 요청을 남기면 처리 상태가 표시됩니다."
            />
          </Card>
        ) : (
          <div className="grid gap-2">
            {data.requests.map((request) => (
              <Card
                key={request.id}
                tone="muted"
                padding="sm"
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <RequestStatusBadge status={request.status} />
                  <span className="text-sm font-semibold text-foreground">
                    {request.brandName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {request.companyName}
                  </span>
                  <PlanBadge tier={request.currentPlanTier} />
                  <span className="text-sm text-muted-foreground">→</span>
                  <PlanBadge tier={request.requestedPlanTier} />
                  <span className="text-sm text-muted-foreground">
                    {formatPartnerPlanCurrency(request.paymentAmountKrw)}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatDateTime(request.createdAt)}
                </span>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
