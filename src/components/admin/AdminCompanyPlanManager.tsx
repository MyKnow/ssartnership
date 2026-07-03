import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
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
import type { PartnerBillingInvoiceRecord } from "@/lib/partner-plan-service";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import {
  approvePartnerPlanUpgradeRequest,
  confirmPartnerPlanBankTransferPayment,
  rejectPartnerPlanUpgradeRequest,
  updatePartnerBrandPlan,
} from "@/app/admin/(protected)/actions";

export type AdminBrandPlanBrand = {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  location: string;
  periodStart: string | null;
  periodEnd: string | null;
  planTier: PartnerCompanyPlanTier;
  planStartedAt: string | null;
  planExpiresAt: string | null;
  planUpdatedAt: string | null;
};

export type AdminCompanyPlanRequest = {
  id: string;
  partnerId: string;
  brandName: string;
  companyId: string;
  companyName: string;
  requestedByDisplayName: string | null;
  currentPlanTier: PartnerCompanyPlanTier;
  requestedPlanTier: PartnerCompanyPlanTier;
  status: "pending" | "approved" | "rejected" | "cancelled";
  paymentAmountKrw: number;
  payerName: string;
  memo: string;
  adminNote: string;
  billingInvoice: PartnerBillingInvoiceRecord | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type AdminCompanyPlanEvent = {
  id: string;
  partnerId: string;
  brandName: string | null;
  companyId: string;
  previousPlanTier: PartnerCompanyPlanTier | null;
  nextPlanTier: PartnerCompanyPlanTier;
  source: "admin" | "partner_upgrade" | "expiration" | "system";
  note: string;
  createdAt: string;
};

function formatDateTime(value?: string | null) {
  return value ? formatKoreanDateTimeToMinute(value) : "없음";
}

function toDateInputValue(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function getStatusBadgeVariant(status: AdminCompanyPlanRequest["status"]) {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
    case "cancelled":
      return "danger";
    default:
      return "warning";
  }
}

function getStatusLabel(status: AdminCompanyPlanRequest["status"]) {
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

function getInvoiceStatusLabel(status?: PartnerBillingInvoiceRecord["invoiceStatus"] | null) {
  switch (status) {
    case "paid":
      return "입금 확인";
    case "overdue":
      return "미납";
    case "cancelled":
      return "청구 취소";
    default:
      return "입금 대기";
  }
}

function getTaxDocumentStatusLabel(
  status?: PartnerBillingInvoiceRecord["taxDocumentStatus"],
) {
  switch (status) {
    case "issued":
      return "세금계산서 발급";
    case "pending_issue":
      return "발급 대기";
    case "cancelled":
      return "증빙 취소";
    default:
      return "발급 요청";
  }
}

function PlanBadge({ tier }: { tier: PartnerCompanyPlanTier }) {
  const definition = getPartnerCompanyPlanDefinition(tier);
  return <Badge variant={tier === "boost" ? "primary" : tier === "partner" ? "success" : "neutral"}>{definition.label}</Badge>;
}

export default function AdminCompanyPlanManager({
  brands,
  requests,
  events,
}: {
  brands: AdminBrandPlanBrand[];
  requests: AdminCompanyPlanRequest[];
  events: AdminCompanyPlanEvent[];
}) {
  const pendingRequests = requests.filter((request) => request.status === "pending");

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-3">
        {PARTNER_COMPANY_PLAN_DEFINITIONS.map((definition) => {
          const count = brands.filter((brand) => brand.planTier === definition.tier).length;
          return (
            <Card key={definition.tier} tone="muted" padding="sm" className="grid gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{definition.label}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{definition.description}</p>
                </div>
                <Badge variant="neutral">{count}개 브랜드</Badge>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {definition.monthlyPriceKrw === 0 ? "무료" : `월 ${formatCurrency(definition.monthlyPriceKrw)}`}
              </p>
            </Card>
          );
        })}
      </div>

      <section className="grid gap-4">
        <SectionHeading
          title="업그레이드 요청"
          description="파트너가 오프라인 결제 정보를 남긴 요청을 확인하고 승인 또는 반려합니다."
        />
        {pendingRequests.length === 0 ? (
          <Card tone="muted" padding="md">
            <EmptyState title="대기 중인 요청이 없습니다." description="파트너 포털에서 요청이 접수되면 이곳에 표시됩니다." />
          </Card>
        ) : (
          <div className="grid gap-3">
            {pendingRequests.map((request) => {
              const billing = request.billingInvoice;
              const isPaid = billing?.invoiceStatus === "paid";
              return (
                <Card key={request.id} tone="elevated" padding="md" className="grid gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(request.status)}>{getStatusLabel(request.status)}</Badge>
                        <Badge variant={isPaid ? "success" : "warning"}>
                          {getInvoiceStatusLabel(billing?.invoiceStatus)}
                        </Badge>
                        <Badge variant={billing?.taxDocumentStatus === "issued" ? "success" : "neutral"}>
                          {getTaxDocumentStatusLabel(billing?.taxDocumentStatus)}
                        </Badge>
                        <PlanBadge tier={request.currentPlanTier} />
                        <span className="text-sm text-muted-foreground">→</span>
                        <PlanBadge tier={request.requestedPlanTier} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{request.brandName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {request.companyName} · 요청자 {request.requestedByDisplayName ?? "담당자"} · {formatDateTime(request.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(billing?.totalAmountKrw ?? request.paymentAmountKrw)}
                    </p>
                  </div>

                  <div className="grid gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-4 text-sm md:grid-cols-3">
                    <p><span className="font-semibold text-foreground">입금자명</span><br />{request.payerName}</p>
                    <p><span className="font-semibold text-foreground">청구번호</span><br />{billing?.invoiceNumber ?? "미생성"}</p>
                    <p><span className="font-semibold text-foreground">납부기한</span><br />{formatDateTime(billing?.dueAt)}</p>
                    <p>
                      <span className="font-semibold text-foreground">공급가액 / VAT</span><br />
                      {billing ? `${formatCurrency(billing.supplyAmountKrw)} / ${formatCurrency(billing.vatAmountKrw)}` : "미생성"}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">청구 기간</span><br />
                      {billing ? `${formatDateTime(billing.servicePeriodStart)} - ${formatDateTime(billing.servicePeriodEnd)}` : "미생성"}
                    </p>
                    <p><span className="font-semibold text-foreground">요청 메모</span><br />{request.memo || "없음"}</p>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <form action={confirmPartnerPlanBankTransferPayment} className="grid gap-3">
                      <input type="hidden" name="requestId" value={request.id} />
                      <Select name="taxDocumentStatus" defaultValue="pending_issue" disabled={isPaid}>
                        <option value="pending_issue">입금 확인 · 세금계산서 발급 대기</option>
                        <option value="issued">입금 확인 · 세금계산서 발급 완료</option>
                      </Select>
                      <SubmitButton
                        pendingText="확인 중"
                        variant="secondary"
                        disabled={isPaid || !billing}
                        className="w-full justify-center"
                      >
                        입금 확인 저장
                      </SubmitButton>
                    </form>
                    <form action={approvePartnerPlanUpgradeRequest} className="grid gap-3">
                      <input type="hidden" name="requestId" value={request.id} />
                      <Textarea name="adminNote" rows={3} placeholder="승인 메모" />
                      <SubmitButton pendingText="승인 중" disabled={!isPaid} className="w-full justify-center">
                        승인하고 플랜 적용
                      </SubmitButton>
                    </form>
                    <form action={rejectPartnerPlanUpgradeRequest} className="grid gap-3">
                      <input type="hidden" name="requestId" value={request.id} />
                      <Textarea name="adminNote" rows={3} placeholder="반려 사유" />
                      <SubmitButton variant="danger" pendingText="반려 중" className="w-full justify-center">
                        요청 반려
                      </SubmitButton>
                    </form>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4">
        <SectionHeading
          title="브랜드별 플랜"
          description="Basic은 제휴기간과 동일하게 적용되고, Partner/Boost는 별도 계약 기간을 입력합니다."
        />
        <div className="grid gap-3">
          {brands.map((brand) => {
            const formId = `brand-plan-${brand.id}`;
            return (
              <Card key={brand.id} tone="default" padding="md" className="grid gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <PlanBadge tier={brand.planTier} />
                      <Badge variant="neutral">{brand.companyName}</Badge>
                      {brand.periodStart || brand.periodEnd ? (
                        <Badge variant="neutral">
                          제휴 {brand.periodStart ?? "미정"} ~ {brand.periodEnd ?? "미정"}
                        </Badge>
                      ) : null}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{brand.name}</h3>
                      <p className="text-sm text-muted-foreground">{brand.location || "위치 미입력"}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    플랜 수정 {formatDateTime(brand.planUpdatedAt)}
                  </p>
                </div>

                <form id={formId} action={updatePartnerBrandPlan} className="grid gap-3 md:grid-cols-5 md:items-end">
                  <input type="hidden" name="partnerId" value={brand.id} />
                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    플랜
                    <Select name="planTier" defaultValue={brand.planTier}>
                      {PARTNER_COMPANY_PLAN_DEFINITIONS.map((definition) => (
                        <option key={definition.tier} value={definition.tier}>
                          {definition.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    시작일
                    <Input name="planStartedAt" type="date" defaultValue={toDateInputValue(brand.planStartedAt)} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    만료일
                    <Input name="planExpiresAt" type="date" defaultValue={toDateInputValue(brand.planExpiresAt)} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-foreground md:col-span-2">
                    메모
                    <Input name="note" placeholder="수동 결제 확인, 계약 조건 등" />
                  </label>
                  <div className="md:col-span-5 flex justify-end">
                    <SubmitButton form={formId} pendingText="저장 중" className="w-full sm:w-auto">
                      플랜 저장
                    </SubmitButton>
                  </div>
                </form>
              </Card>
            );
            })}
        </div>
      </section>

      <section className="grid gap-4">
        <SectionHeading title="최근 플랜 이력" description="관리자 변경과 파트너 업그레이드 승인 이력을 확인합니다." />
        {events.length === 0 ? (
          <Card tone="muted" padding="md">
            <EmptyState title="플랜 이력이 없습니다." description="플랜 변경이 발생하면 이곳에 기록됩니다." />
          </Card>
        ) : (
          <div className="grid gap-2">
            {events.slice(0, 20).map((event) => {
              const brand = brands.find((item) => item.id === event.partnerId);
              return (
                <Card key={event.id} tone="muted" padding="sm" className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{brand?.name ?? event.brandName ?? "브랜드"}</span>
                    {event.previousPlanTier ? <PlanBadge tier={event.previousPlanTier} /> : null}
                    <span className="text-sm text-muted-foreground">→</span>
                    <PlanBadge tier={event.nextPlanTier} />
                    {event.note ? <span className="text-sm text-muted-foreground">{event.note}</span> : null}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</span>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button href="/admin/advertisement" variant="secondary">광고 캠페인 관리</Button>
      </div>
    </div>
  );
}
