"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Landmark, ReceiptText, TrendingUp } from "lucide-react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import SubmitButton from "@/components/ui/SubmitButton";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import type { PartnerPlanUpgradeCharge } from "@/lib/partner-billing";
import type { PartnerBillingProfileRecord } from "@/lib/partner-billing-profiles";
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
import { getCompanyScopedPortalHref } from "@/lib/partner-portal-paths";
import { requestPartnerPlanUpgradeAction } from "@/app/partner/plans/actions";

type PartnerPlanUpgradeFormProps = {
  companyId: string;
  partnerId: string;
  currentPlanTier: PartnerCompanyPlanTier;
  upgradeOptions: Array<
    PartnerCompanyPlanDefinition & { billingCharge: PartnerPlanUpgradeCharge }
  >;
  bankTransferAccount: PartnerBankTransferAccount;
  billingProfiles: PartnerBillingProfileRecord[];
};

export default function PartnerPlanUpgradeForm({
  companyId,
  partnerId,
  currentPlanTier,
  upgradeOptions,
  bankTransferAccount,
  billingProfiles,
}: PartnerPlanUpgradeFormProps) {
  const initialTier = upgradeOptions[0]?.tier ?? currentPlanTier;
  const [selectedTier, setSelectedTier] =
    useState<PartnerCompanyPlanTier>(initialTier);
  const initialProfileId =
    billingProfiles.find((profile) => profile.isDefault)?.id ??
    billingProfiles[0]?.id ??
    "";
  const [selectedProfileId, setSelectedProfileId] = useState(initialProfileId);
  const selectedOption = useMemo(
    () =>
      upgradeOptions.find((definition) => definition.tier === selectedTier) ??
      upgradeOptions[0] ??
      null,
    [selectedTier, upgradeOptions],
  );
  const selectedBillingProfile = useMemo(
    () =>
      billingProfiles.find((profile) => profile.id === selectedProfileId) ??
      billingProfiles.find((profile) => profile.isDefault) ??
      billingProfiles[0] ??
      null,
    [billingProfiles, selectedProfileId],
  );

  if (!selectedOption) {
    return null;
  }
  const selectedCharge = selectedOption.billingCharge;
  const accountInfoHref = getCompanyScopedPortalHref(companyId, "account");

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
          <div className="min-w-0">
            <p className="break-keep text-sm font-semibold text-foreground">
              1. 목표 플랜과 결제 예정액
            </p>
            <p className="mt-1 line-clamp-2 break-keep text-xs leading-5 text-muted-foreground">
              VAT 포함가 기준으로 월 플랜가와 이번 계좌이체 금액을 분리해 확인합니다.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <TrendingUp className="h-3.5 w-3.5" />
            월 플랜가 {formatPartnerPlanMonthlyPrice(selectedOption.tier).replace(/^월 /, "")}
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
                <span className="flex min-w-0 items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {definition.label}
                    </span>
                    <span
                      className={cn(
                        "mt-1 line-clamp-2 break-keep text-xs leading-5",
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
                  <span className="rounded-full border border-current/15 px-2 py-0.5 text-[11px] font-semibold">
                    결제 {formatPartnerPlanCurrency(definition.billingCharge.totalAmountKrw)}
                  </span>
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
            <p className="break-keep font-semibold text-foreground">
              이번 결제 예정액 {formatPartnerPlanCurrency(selectedCharge.totalAmountKrw)}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              공급가액 {formatPartnerPlanCurrency(selectedCharge.supplyAmountKrw)} ·
              VAT {formatPartnerPlanCurrency(selectedCharge.vatAmountKrw)} ·
              산정 기준:
              {selectedCharge.policy === "remaining_period_difference"
                ? ` 남은 ${selectedCharge.remainingDays}일 차액`
                : " 최초 1개월"}
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

      <div>
        <p className="text-sm font-semibold text-foreground">
          2. 계정 정보 선택
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          계정 정보 탭에 저장된 입금자와 세금계산서 정보를 이번 요청에 사용합니다.
        </p>
      </div>

      {billingProfiles.length === 0 ? (
        <div className="grid gap-3 rounded-[0.9rem] border border-warning/25 bg-warning/10 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              저장된 계정 정보가 없습니다.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              계정 정보 탭에서 입금자와 세금계산서 정보를 먼저 저장해 주세요.
            </p>
          </div>
          <Button href={accountInfoHref} variant="secondary" className="w-full sm:w-auto">
            계정 정보 추가
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 rounded-[0.9rem] border border-border bg-surface-control p-4">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            사용할 계정 정보
            <Select
              name="billingProfileId"
              required
              value={selectedBillingProfile?.id ?? ""}
              onChange={(event) => {
                setSelectedProfileId(event.target.value);
              }}
            >
              {billingProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                  {profile.isDefault ? " · 기본" : ""} · {profile.payerName}
                </option>
              ))}
            </Select>
          </label>

          {selectedBillingProfile ? (
            <div className="grid gap-2 rounded-[0.8rem] bg-surface-inset p-3 text-xs leading-5 text-muted-foreground">
              <p className="font-semibold text-foreground">
                {selectedBillingProfile.businessName} · 입금자{" "}
                {selectedBillingProfile.payerName}
              </p>
              <p>
                사업자등록번호 {selectedBillingProfile.businessRegistrationNumber} ·
                대표자 {selectedBillingProfile.representativeName}
              </p>
              <p className="break-all">
                세금계산서 이메일 {selectedBillingProfile.taxInvoiceEmail}
              </p>
              <p>{selectedBillingProfile.businessAddress}</p>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button href={accountInfoHref} variant="secondary" size="sm">
              계정 정보 관리
            </Button>
          </div>
        </div>
      )}

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
        <SubmitButton
          pendingText="요청 중"
          disabled={billingProfiles.length === 0}
          className="w-full sm:w-auto"
        >
          업그레이드 요청
        </SubmitButton>
      </div>
    </form>
  );
}
