"use client";

import { useState, type FormEvent } from "react";
import FormMessage from "@/components/ui/FormMessage";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { getPartnerPeriodEndAt, toDateTimeLocalInput } from "@/lib/ad-coupon-period";
import {
  AD_PACKAGE_FORM_LIMITS,
  parseCreateAdCouponForm,
} from "@/lib/ad-package-validation";
import type { AdCampaignWithStats, AdCoupon } from "@/lib/repositories/ad-package-repository";
import { cn } from "@/lib/cn";

type ServerAction = (formData: FormData) => void | Promise<void>;

function toDateTimeLocal(date: Date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

function formatDateTimeLocal(value: string) {
  return toDateTimeLocal(new Date(value));
}

function FieldLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid min-w-0 gap-2 text-sm font-medium text-foreground", className)}>
      {children}
    </label>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid min-w-0 gap-4 rounded-[1.1rem] border border-border/70 bg-surface-inset/40 p-4 sm:p-5">
      <legend className="px-2 text-sm font-semibold text-foreground">{title}</legend>
      {description ? (
        <p className="-mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </fieldset>
  );
}

function getDefaultValues(coupon?: AdCoupon, partnerPeriodEnd?: string | null) {
  if (coupon) {
    return {
      startsAt: formatDateTimeLocal(coupon.startsAt),
      endsAt: formatDateTimeLocal(coupon.endsAt),
      downloadStartsAt: formatDateTimeLocal(coupon.downloadStartsAt),
      downloadEndsAt: formatDateTimeLocal(coupon.downloadEndsAt),
      usageStartsAt: formatDateTimeLocal(coupon.usageStartsAt),
      usageEndsAt: formatDateTimeLocal(coupon.usageEndsAt),
      campaignId: coupon.campaignId ?? "",
      title: coupon.title,
      discountLabel: coupon.discountLabel,
      code: coupon.code,
      description: coupon.description,
      issuanceType: coupon.issuanceType,
      redemptionType: coupon.redemptionType,
      status: coupon.status,
      usageLimit: coupon.usageLimit?.toString() ?? "",
      dailyIssueLimit: coupon.dailyIssueLimit?.toString() ?? "",
      weeklyIssueLimit: coupon.weeklyIssueLimit?.toString() ?? "",
      monthlyIssueLimit: coupon.monthlyIssueLimit?.toString() ?? "",
      perMemberLimit: coupon.perMemberLimit.toString(),
      perMemberDailyIssueLimit: coupon.perMemberDailyIssueLimit?.toString() ?? "",
      perMemberWeeklyIssueLimit: coupon.perMemberWeeklyIssueLimit?.toString() ?? "",
      perMemberMonthlyIssueLimit: coupon.perMemberMonthlyIssueLimit?.toString() ?? "",
      externalUrl: coupon.externalUrl,
      terms: coupon.terms.join("\n"),
    };
  }

  const now = new Date();
  const startsAt = toDateTimeLocal(now);
  const endsAt = toDateTimeLocalInput(getPartnerPeriodEndAt(partnerPeriodEnd));
  return {
    startsAt,
    endsAt,
    downloadStartsAt: startsAt,
    downloadEndsAt: endsAt,
    usageStartsAt: startsAt,
    usageEndsAt: endsAt,
    campaignId: "",
    title: "",
    discountLabel: "",
    code: "",
    description: "",
    issuanceType: "service" as const,
    redemptionType: "onsite" as const,
    status: "draft" as const,
    usageLimit: "",
    dailyIssueLimit: "",
    weeklyIssueLimit: "",
    monthlyIssueLimit: "",
    perMemberLimit: "1",
    perMemberDailyIssueLimit: "",
    perMemberWeeklyIssueLimit: "",
    perMemberMonthlyIssueLimit: "",
    externalUrl: "",
    terms: "",
  };
}

export default function AdminPartnerCouponForm({
  partnerId,
  partnerName,
  campaigns,
  action,
  mode,
  coupon,
  partnerPeriodEnd,
  submitLabel,
}: {
  partnerId: string;
  partnerName: string;
  campaigns: AdCampaignWithStats[];
  action: ServerAction;
  mode: "create" | "edit";
  coupon?: AdCoupon;
  partnerPeriodEnd?: string | null;
  submitLabel: string;
}) {
  const defaults = getDefaultValues(coupon, partnerPeriodEnd);
  const hasPartnerPeriodEnd = Boolean(getPartnerPeriodEndAt(partnerPeriodEnd));
  const [issuanceType, setIssuanceType] = useState(defaults.issuanceType);
  const [redemptionType, setRedemptionType] = useState(defaults.redemptionType);
  const [formError, setFormError] = useState<string | null>(null);
  const formErrorId = `admin-coupon-form-error-${mode}-${coupon?.id ?? partnerId}`;

  const handleNativeInvalid = () => {
    setFormError("입력값을 확인해 주세요.");
  };

  const handleFormInput = () => {
    setFormError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    try {
      parseCreateAdCouponForm(new FormData(event.currentTarget), {
        allowExistingOnsitePassword: mode === "edit",
        partnerPeriodEnd,
      });
      setFormError(null);
    } catch (error) {
      event.preventDefault();
      setFormError(error instanceof Error ? error.message : "입력값을 확인해 주세요.");
    }
  };

  return (
    <form
      action={action}
      className="grid min-w-0 gap-4"
      aria-describedby={formError ? formErrorId : undefined}
      onInputCapture={handleFormInput}
      onInvalidCapture={handleNativeInvalid}
      onSubmit={handleSubmit}
    >
      {formError ? (
        <FormMessage
          variant="error"
          className="flex flex-wrap items-center gap-2"
          id={formErrorId}
        >
          <span className="inline-flex shrink-0 items-center rounded-full border border-danger/25 bg-danger/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em]">
            Error
          </span>
          <span>{formError}</span>
        </FormMessage>
      ) : null}
        <input type="hidden" name="partnerId" value={partnerId} readOnly />
        {coupon ? <input type="hidden" name="couponId" value={coupon.id} readOnly /> : null}

        <FormSection
          title="기본 정보"
          description="회원에게 보여줄 쿠폰의 기본 정보와 운영 캠페인을 설정합니다."
        >
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <FieldLabel>
              제휴처
              <div className="flex h-11 min-w-0 items-center rounded-[1rem] border border-border bg-surface-control px-3.5 text-sm text-foreground">
                <span className="truncate">{partnerName}</span>
              </div>
            </FieldLabel>
            <FieldLabel>
              캠페인
              <Select name="campaignId" defaultValue={defaults.campaignId}>
                <option value="">캠페인 없이 쿠폰만 등록</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.title}
                  </option>
                ))}
              </Select>
            </FieldLabel>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <FieldLabel>
              쿠폰명
              <Input
                name="title"
                maxLength={AD_PACKAGE_FORM_LIMITS.titleMax}
                required
                defaultValue={defaults.title}
                placeholder="예: 점심 세트 10% 할인"
              />
            </FieldLabel>
            <FieldLabel>
              혜택 표기
              <Input
                name="discountLabel"
                maxLength={AD_PACKAGE_FORM_LIMITS.discountLabelMax}
                defaultValue={defaults.discountLabel}
                placeholder="10% 할인"
              />
            </FieldLabel>
            <FieldLabel className="sm:col-span-2">
              설명
              <Textarea
                name="description"
                maxLength={AD_PACKAGE_FORM_LIMITS.descriptionMax}
                rows={3}
                defaultValue={defaults.description}
                placeholder="사용 가능 시간, 대상 메뉴, 매장 확인 방법"
              />
            </FieldLabel>
          </div>
        </FormSection>

        <FormSection
          title="발급·사용 방식"
          description="쿠폰을 발급하고 제휴처에서 확인하는 방식을 선택합니다."
        >
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <FieldLabel>
              발급 방식
              <Select
                name="issuanceType"
                value={issuanceType}
                onChange={(event) => {
                  setIssuanceType(event.target.value as typeof defaults.issuanceType);
                }}
              >
                <option value="service">서비스 발급형</option>
                <option value="partner_code_pool">파트너 코드형</option>
              </Select>
            </FieldLabel>
            <FieldLabel>
              사용 방식
              <Select
                name="redemptionType"
                value={redemptionType}
                onChange={(event) => {
                  setRedemptionType(event.target.value as typeof defaults.redemptionType);
                }}
              >
                <option value="onsite">현장 확인</option>
                <option value="code">코드 제시</option>
                <option value="external">외부 링크</option>
              </Select>
            </FieldLabel>
          </div>
          {redemptionType === "onsite" || redemptionType === "external" ? (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {redemptionType === "onsite" ? (
                <FieldLabel>
                  현장 확인 PIN
                  <Input
                    name="onsitePassword"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    autoComplete="off"
                    required={mode === "create"}
                    placeholder={mode === "edit" ? "변경 시 4자리 입력" : "4자리 숫자 입력"}
                    aria-describedby={`partner-onsite-password-help-${mode}`}
                  />
                  <span id={`partner-onsite-password-help-${mode}`} className="text-xs font-normal text-muted-foreground">
                    {mode === "edit"
                      ? "변경하지 않으면 기존 PIN을 유지합니다. 숫자 4자리만 입력해 주세요."
                      : "현장 확인형 쿠폰에 사용할 숫자 4자리 PIN입니다."}
                  </span>
                </FieldLabel>
              ) : null}
              {redemptionType === "external" ? (
                <FieldLabel>
                  외부 링크
                  <Input name="externalUrl" type="url" defaultValue={defaults.externalUrl} placeholder="https://..." required />
                </FieldLabel>
              ) : null}
            </div>
          ) : null}
        </FormSection>

        <FormSection
          title="운영 기간"
          description={
            hasPartnerPeriodEnd
              ? "종료일을 비워두면 제휴처 기간 종료일 23:59로 설정됩니다."
              : "제휴처 기간 종료일이 없어 각 종료일을 직접 입력해야 합니다."
          }
        >
          <div className="grid min-w-0 gap-4">
            <div className="grid min-w-0 gap-3 border-b border-border/60 pb-4 sm:grid-cols-2">
              <FieldLabel>
                전체 유효 시작
                <Input name="startsAt" type="datetime-local" defaultValue={defaults.startsAt} required />
              </FieldLabel>
              <FieldLabel>
                전체 유효 종료
                <Input name="endsAt" type="datetime-local" defaultValue={defaults.endsAt} required={!hasPartnerPeriodEnd} />
              </FieldLabel>
            </div>
            <div className="grid min-w-0 gap-3 border-b border-border/60 pb-4 sm:grid-cols-2">
              <FieldLabel>
                다운로드 시작
                <Input name="downloadStartsAt" type="datetime-local" defaultValue={defaults.downloadStartsAt} required />
              </FieldLabel>
              <FieldLabel>
                다운로드 종료
                <Input name="downloadEndsAt" type="datetime-local" defaultValue={defaults.downloadEndsAt} required={!hasPartnerPeriodEnd} />
              </FieldLabel>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <FieldLabel>
                사용 시작
                <Input name="usageStartsAt" type="datetime-local" defaultValue={defaults.usageStartsAt} required />
              </FieldLabel>
              <FieldLabel>
                사용 종료
                <Input name="usageEndsAt" type="datetime-local" defaultValue={defaults.usageEndsAt} required={!hasPartnerPeriodEnd} />
              </FieldLabel>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="발급 한도 및 상태"
          description="전체 한도와 회원별 한도를 설정합니다. 회원별 일·주·월 한도를 비워두면 무제한으로 처리됩니다."
        >
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <FieldLabel>
              상태
              <Select name="status" defaultValue={defaults.status}>
                <option value="draft">초안</option>
                <option value="active">활성</option>
                <option value="paused">일시중지</option>
                <option value="ended">종료</option>
              </Select>
            </FieldLabel>
            <FieldLabel>
              전체 사용 한도
              <Input name="usageLimit" type="number" min={0} step={1} defaultValue={defaults.usageLimit} placeholder="무제한" />
            </FieldLabel>
            <FieldLabel>
              일 발급 한도
              <Input name="dailyIssueLimit" type="number" min={0} step={1} defaultValue={defaults.dailyIssueLimit} placeholder="무제한" />
            </FieldLabel>
            <FieldLabel>
              주 발급 한도
              <Input name="weeklyIssueLimit" type="number" min={0} step={1} defaultValue={defaults.weeklyIssueLimit} placeholder="무제한" />
            </FieldLabel>
            <FieldLabel>
              월 발급 한도
              <Input name="monthlyIssueLimit" type="number" min={0} step={1} defaultValue={defaults.monthlyIssueLimit} placeholder="무제한" />
            </FieldLabel>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FieldLabel>
              회원별 총 보유/사용 제한
              <Input name="perMemberLimit" type="number" min={1} step={1} defaultValue={defaults.perMemberLimit} />
            </FieldLabel>
            <FieldLabel>
              회원별 일 발급 한도
              <Input name="perMemberDailyIssueLimit" type="number" min={0} step={1} defaultValue={defaults.perMemberDailyIssueLimit} placeholder="무제한" />
            </FieldLabel>
            <FieldLabel>
              회원별 주 발급 한도
              <Input name="perMemberWeeklyIssueLimit" type="number" min={0} step={1} defaultValue={defaults.perMemberWeeklyIssueLimit} placeholder="무제한" />
            </FieldLabel>
            <FieldLabel>
              회원별 월 발급 한도
              <Input name="perMemberMonthlyIssueLimit" type="number" min={0} step={1} defaultValue={defaults.perMemberMonthlyIssueLimit} placeholder="무제한" />
            </FieldLabel>
          </div>
        </FormSection>

        <FormSection title="사용 안내" description="제휴처에서 확인할 조건과 회원에게 보여줄 사용 안내를 입력합니다.">
          <FieldLabel>
            조건
            <Textarea name="terms" rows={4} defaultValue={defaults.terms} placeholder={"평일 점심 한정\n1일 1회 사용\n타 쿠폰 중복 불가"} />
          </FieldLabel>
        </FormSection>

        {issuanceType === "partner_code_pool" ? (
          <FormSection
            title="파트너 코드 관리"
            description="파트너사가 전달한 코드를 한 줄에 하나씩 추가합니다. 이미 등록된 코드는 자동으로 건너뜁니다."
          >
            <FieldLabel>
              {mode === "edit" ? "파트너 코드 추가 목록" : "파트너 코드 목록"}
              <Textarea name="codePool" rows={5} placeholder="파트너가 전달한 쿠폰 코드를 붙여 넣으세요." />
            </FieldLabel>
          </FormSection>
        ) : null}
        <FormSubmitButton loadingText={mode === "edit" ? "저장 중" : "생성 중"} className="w-full justify-center sm:w-fit">
          {submitLabel}
        </FormSubmitButton>
    </form>
  );
}
