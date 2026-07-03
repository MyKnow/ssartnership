"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Landmark, ReceiptText, TrendingUp } from "lucide-react";
import Input from "@/components/ui/Input";
import SubmitButton from "@/components/ui/SubmitButton";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import type { PartnerPlanUpgradeCharge } from "@/lib/partner-billing";
import type { PartnerBankTransferAccount } from "@/lib/partner-billing-config";
import type {
  PartnerCompanyPlanDefinition,
  PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";
import {
  formatPartnerPlanCurrency,
  formatPartnerPlanMonthlyPrice,
  getPartnerPlanChannelLabel,
} from "@/lib/partner-plan-ui";
import { requestPartnerPlanUpgradeAction } from "@/app/partner/plans/actions";

type PartnerPlanUpgradeFormProps = {
  companyId: string;
  partnerId: string;
  currentPlanTier: PartnerCompanyPlanTier;
  upgradeOptions: Array<
    PartnerCompanyPlanDefinition & { billingCharge: PartnerPlanUpgradeCharge }
  >;
  bankTransferAccount: PartnerBankTransferAccount;
};

export default function PartnerPlanUpgradeForm({
  companyId,
  partnerId,
  currentPlanTier,
  upgradeOptions,
  bankTransferAccount,
}: PartnerPlanUpgradeFormProps) {
  const initialTier = upgradeOptions[0]?.tier ?? currentPlanTier;
  const [selectedTier, setSelectedTier] =
    useState<PartnerCompanyPlanTier>(initialTier);
  const selectedOption = useMemo(
    () =>
      upgradeOptions.find((definition) => definition.tier === selectedTier) ??
      upgradeOptions[0] ??
      null,
    [selectedTier, upgradeOptions],
  );

  if (!selectedOption) {
    return null;
  }
  const selectedCharge = selectedOption.billingCharge;

  return (
    <form
      action={requestPartnerPlanUpgradeAction}
      className="grid gap-4 rounded-[1rem] border border-border/70 bg-surface-inset p-4"
    >
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="partnerId" value={partnerId} />
      <input type="hidden" name="requestedPlanTier" value={selectedOption.tier} />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">업그레이드 요청</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              목표 플랜을 고르면 VAT 포함 청구 금액이 자동 계산됩니다.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <TrendingUp className="h-3.5 w-3.5" />
            {formatPartnerPlanMonthlyPrice(selectedOption.tier)}
          </span>
        </div>

        <div
          role="radiogroup"
          aria-label="요청 플랜 선택"
          className="grid gap-2 sm:grid-cols-2"
        >
          {upgradeOptions.map((definition) => {
            const selected = definition.tier === selectedOption.tier;
            return (
              <button
                key={definition.tier}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setSelectedTier(definition.tier);
                }}
                className={cn(
                  "grid min-h-28 gap-3 rounded-[1rem] border p-4 text-left transition-surface",
                  selected
                    ? "border-primary bg-primary-soft text-primary shadow-flat"
                    : "border-border bg-surface-control text-foreground hover:border-strong hover:bg-surface-elevated",
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm font-semibold">
                      {definition.label}
                    </span>
                    <span
                      className={cn(
                        "mt-1 block text-xs leading-5",
                        selected ? "text-primary/80" : "text-muted-foreground",
                      )}
                    >
                      {definition.description}
                    </span>
                  </span>
                  {selected ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : null}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {definition.allowedAdChannels.slice(0, 3).map((channel) => (
                    <span
                      key={channel}
                      className="rounded-full border border-current/15 px-2 py-0.5 text-[11px] font-semibold"
                    >
                      {getPartnerPlanChannelLabel(channel)}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 rounded-[0.9rem] border border-border bg-surface-control p-4 text-sm">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.8rem] border border-primary/15 bg-primary-soft text-primary">
            <ReceiptText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">
              청구 금액 {formatPartnerPlanCurrency(selectedCharge.totalAmountKrw)}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              공급가액 {formatPartnerPlanCurrency(selectedCharge.supplyAmountKrw)} ·
              VAT {formatPartnerPlanCurrency(selectedCharge.vatAmountKrw)} ·
              {selectedCharge.policy === "remaining_period_difference"
                ? ` 남은 ${selectedCharge.remainingDays}일 차액`
                : " 최초 1개월 기준"}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-[0.8rem] bg-surface-inset p-3">
          <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 text-xs leading-5 text-muted-foreground">
            {bankTransferAccount.configured ? (
              <p>
                {bankTransferAccount.bankName} {bankTransferAccount.accountNumber} ·
                예금주 {bankTransferAccount.accountHolder}
              </p>
            ) : (
              <p>
                계좌 정보가 아직 설정되지 않았습니다. 요청 접수 후 관리자가 입금 계좌를 안내합니다.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-foreground">
          입금자명
          <Input name="payerName" maxLength={80} required />
          <span className="text-xs font-normal text-muted-foreground">
            실제 입금 내역과 같은 이름을 입력해 주세요.
          </span>
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          세금계산서 이메일
          <Input name="taxInvoiceEmail" type="email" maxLength={254} required />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-foreground">
          사업자등록번호
          <Input
            name="businessRegistrationNumber"
            inputMode="numeric"
            placeholder="000-00-00000"
            maxLength={12}
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          상호
          <Input name="businessName" maxLength={120} required />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          대표자명
          <Input name="representativeName" maxLength={80} required />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          사업장 주소
          <Input name="businessAddress" maxLength={300} required />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          업태
          <Input name="businessType" maxLength={80} required />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          종목
          <Input name="businessItem" maxLength={120} required />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-foreground">
        요청 메모
        <Textarea
          name="memo"
          rows={3}
          maxLength={1000}
          placeholder="입금 일시, 계약 조건, 세금계산서 요청 등"
        />
      </label>

      <div className="flex justify-end">
        <SubmitButton pendingText="요청 중" className="w-full sm:w-auto">
          업그레이드 요청
        </SubmitButton>
      </div>
    </form>
  );
}
