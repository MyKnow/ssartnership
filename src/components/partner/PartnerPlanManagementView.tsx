import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";
import Textarea from "@/components/ui/Textarea";
import {
  PARTNER_COMPANY_PLAN_DEFINITIONS,
  getPartnerCompanyPlanDefinition,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";
import type { PartnerPlanPortalData } from "@/lib/partner-plan-service";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import {
  cancelPartnerPlanUpgradeRequestAction,
  requestPartnerPlanUpgradeAction,
} from "@/app/partner/plans/actions";

const planRank: Record<PartnerCompanyPlanTier, number> = {
  basic: 10,
  partner: 20,
  boost: 30,
};

function formatDateTime(value?: string | null) {
  return value ? formatKoreanDateTimeToMinute(value) : "없음";
}

function formatCurrency(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function PlanBadge({ tier }: { tier: PartnerCompanyPlanTier }) {
  const definition = getPartnerCompanyPlanDefinition(tier);
  return <Badge variant={tier === "boost" ? "primary" : tier === "partner" ? "success" : "neutral"}>{definition.label}</Badge>;
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

export default function PartnerPlanManagementView({
  data,
  companyId,
}: {
  data: PartnerPlanPortalData;
  companyId: string;
}) {
  if (data.brands.length === 0) {
    return (
      <EmptyState
        title="연결된 브랜드가 없습니다."
        description="관리자에서 담당 계정과 브랜드가 속한 파트너사를 먼저 연결해야 합니다."
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 md:grid-cols-3">
        {PARTNER_COMPANY_PLAN_DEFINITIONS.map((definition) => (
          <Card key={definition.tier} tone="muted" padding="sm" className="grid gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{definition.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{definition.description}</p>
              </div>
              <Badge variant="neutral">{definition.allowedAdChannels.length}채널</Badge>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {definition.monthlyPriceKrw === 0 ? "무료" : `월 ${formatCurrency(definition.monthlyPriceKrw)}`}
            </p>
          </Card>
        ))}
      </div>

      <section className="grid gap-4">
        <SectionHeading
          title="브랜드별 현재 플랜"
          description="오프라인 결제 후 입금 정보를 남기면 관리자가 확인 후 플랜을 적용합니다."
        />
        <div className="grid gap-3">
          {data.brands.map((brand) => {
            const pendingRequest = data.requests.find(
              (request) => request.partnerId === brand.id && request.status === "pending",
            );
            const upgradeOptions = PARTNER_COMPANY_PLAN_DEFINITIONS.filter(
              (definition) => planRank[definition.tier] > planRank[brand.planTier],
            );

            return (
              <Card key={brand.id} tone="default" padding="md" className="grid gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <PlanBadge tier={brand.planTier} />
                      <Badge variant="neutral">{brand.companyName}</Badge>
                      <Badge variant="neutral">{brand.visibility}</Badge>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">{brand.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        플랜 수정 {formatDateTime(brand.planUpdatedAt)}
                        {brand.planStartedAt ? ` · 시작 ${formatDateTime(brand.planStartedAt)}` : ""}
                        {brand.planExpiresAt ? ` · 만료 ${formatDateTime(brand.planExpiresAt)}` : ""}
                      </p>
                    </div>
                  </div>
                </div>

                {pendingRequest ? (
                  <div className="grid gap-3 rounded-[1rem] border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">승인 대기 중인 요청</p>
                        <p className="text-sm text-muted-foreground">
                          <PlanBadge tier={pendingRequest.currentPlanTier} /> → <PlanBadge tier={pendingRequest.requestedPlanTier} />
                          {" "}· {formatCurrency(pendingRequest.paymentAmountKrw)}
                        </p>
                      </div>
                      <form action={cancelPartnerPlanUpgradeRequestAction}>
                        <input type="hidden" name="companyId" value={companyId} />
                        <input type="hidden" name="requestId" value={pendingRequest.id} />
                        <SubmitButton variant="secondary" pendingText="취소 중">
                          요청 취소
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                ) : upgradeOptions.length === 0 ? (
                  <Card tone="muted" padding="sm">
                    <p className="text-sm text-muted-foreground">현재 이용 가능한 최상위 플랜입니다.</p>
                  </Card>
                ) : (
                  <form action={requestPartnerPlanUpgradeAction} className="grid gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4">
                    <input type="hidden" name="companyId" value={companyId} />
                    <input type="hidden" name="partnerId" value={brand.id} />
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="grid gap-2 text-sm font-medium text-foreground">
                        요청 플랜
                        <Select name="requestedPlanTier" defaultValue={upgradeOptions[0]?.tier}>
                          {upgradeOptions.map((definition) => (
                            <option key={definition.tier} value={definition.tier}>
                              {definition.label} ({formatCurrency(definition.monthlyPriceKrw)})
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-foreground">
                        결제 금액
                        <Input name="paymentAmountKrw" type="number" min={0} step={1000} defaultValue={upgradeOptions[0]?.monthlyPriceKrw ?? 0} required />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-foreground">
                        입금자명
                        <Input name="payerName" maxLength={80} required />
                      </label>
                    </div>
                    <label className="grid gap-2 text-sm font-medium text-foreground">
                      요청 메모
                      <Textarea name="memo" rows={3} maxLength={1000} placeholder="입금 일시, 계약 조건, 세금계산서 요청 등" />
                    </label>
                    <div className="flex justify-end">
                      <SubmitButton pendingText="요청 중" className="w-full sm:w-auto">
                        업그레이드 요청
                      </SubmitButton>
                    </div>
                  </form>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4">
        <SectionHeading title="요청 이력" description="최근 업그레이드 요청 처리 상태입니다." />
        {data.requests.length === 0 ? (
          <Card tone="muted" padding="md">
            <EmptyState title="요청 이력이 없습니다." description="업그레이드 요청을 남기면 처리 상태가 표시됩니다." />
          </Card>
        ) : (
          <div className="grid gap-2">
            {data.requests.map((request) => (
              <Card key={request.id} tone="muted" padding="sm" className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={request.status === "pending" ? "warning" : request.status === "approved" ? "success" : "neutral"}>
                    {getRequestStatusLabel(request.status)}
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">{request.brandName}</span>
                  <span className="text-xs text-muted-foreground">{request.companyName}</span>
                  <PlanBadge tier={request.currentPlanTier} />
                  <span className="text-sm text-muted-foreground">→</span>
                  <PlanBadge tier={request.requestedPlanTier} />
                  <span className="text-sm text-muted-foreground">{formatCurrency(request.paymentAmountKrw)}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDateTime(request.createdAt)}</span>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
