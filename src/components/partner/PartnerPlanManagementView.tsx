import { Clock3 } from "lucide-react";
import PartnerPlanBrandList from "@/components/partner/PartnerPlanBrandList";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SectionHeading from "@/components/ui/SectionHeading";
import {
  PARTNER_COMPANY_PLAN_DEFINITIONS,
  getPartnerCompanyPlanDefinition,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";
import type { PartnerBankTransferAccount } from "@/lib/partner-billing-config";
import type { PartnerPlanPortalData } from "@/lib/partner-plan-service";
import {
  formatPartnerPlanCurrency,
  formatPartnerPlanMonthlyPrice,
  getPartnerPlanChannelLabel,
  getPartnerPlanProgressLabel,
} from "@/lib/partner-plan-ui";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";

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
              브랜드별 플랜, 요청 상태, 결제 예정액을 한 화면에서 관리합니다.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={pendingRequestCount > 0 ? "warning" : "neutral"}>
              승인 대기 {pendingRequestCount.toLocaleString("ko-KR")}건
            </Badge>
            <Badge variant={expiringBrandCount > 0 ? "warning" : "neutral"}>
              종료/만료 임박 {expiringBrandCount.toLocaleString("ko-KR")}건
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
          description="필요한 브랜드만 펼쳐 업그레이드 요청과 세금계산서 정보를 입력합니다."
        />
        <PartnerPlanBrandList
          data={data}
          companyId={companyId}
          bankTransferAccount={bankTransferAccount}
          nowIso={nowIso}
        />
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
