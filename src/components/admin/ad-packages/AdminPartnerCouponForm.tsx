import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { AD_PACKAGE_FORM_LIMITS } from "@/lib/ad-package-validation";
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

function getDefaultValues(coupon?: AdCoupon) {
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
  const endsAt = toDateTimeLocal(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));
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
  title,
  description,
  submitLabel,
}: {
  partnerId: string;
  partnerName: string;
  campaigns: AdCampaignWithStats[];
  action: ServerAction;
  mode: "create" | "edit";
  coupon?: AdCoupon;
  title: string;
  description: string;
  submitLabel: string;
}) {
  const defaults = getDefaultValues(coupon);

  return (
    <Card tone="elevated" className="grid min-w-0 gap-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <form action={action} className="grid min-w-0 gap-4">
        <input type="hidden" name="partnerId" value={partnerId} readOnly />
        {coupon ? <input type="hidden" name="couponId" value={coupon.id} readOnly /> : null}

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <FieldLabel>
            제휴처
            <div className="flex h-11 min-w-0 items-center rounded-[1rem] border border-border bg-surface-inset px-3.5 text-sm text-foreground">
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

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <FieldLabel>
            할인 표기
            <Input
              name="discountLabel"
              maxLength={AD_PACKAGE_FORM_LIMITS.discountLabelMax}
              defaultValue={defaults.discountLabel}
              placeholder="10% 할인"
            />
          </FieldLabel>
          <FieldLabel>
            쿠폰 코드
            <Input
              name="code"
              maxLength={AD_PACKAGE_FORM_LIMITS.codeMax}
              defaultValue={defaults.code}
              placeholder="서비스 발급형은 자동 지정"
            />
          </FieldLabel>
        </div>

        <FieldLabel>
          설명
          <Textarea
            name="description"
            maxLength={AD_PACKAGE_FORM_LIMITS.descriptionMax}
            rows={3}
            defaultValue={defaults.description}
            placeholder="사용 가능 시간, 대상 메뉴, 매장 확인 방법"
          />
        </FieldLabel>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <FieldLabel>
            발급 방식
            <Select name="issuanceType" defaultValue={defaults.issuanceType}>
              <option value="service">서비스 발급형</option>
              <option value="partner_code_pool">파트너 코드형</option>
            </Select>
          </FieldLabel>
          <FieldLabel>
            사용 방식
            <Select name="redemptionType" defaultValue={defaults.redemptionType}>
              <option value="onsite">현장 확인</option>
              <option value="code">코드 제시</option>
              <option value="external">외부 링크</option>
            </Select>
          </FieldLabel>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <FieldLabel>
            전체 유효 시작
            <Input name="startsAt" type="datetime-local" defaultValue={defaults.startsAt} required />
          </FieldLabel>
          <FieldLabel>
            전체 유효 종료
            <Input name="endsAt" type="datetime-local" defaultValue={defaults.endsAt} required />
          </FieldLabel>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <FieldLabel>
            다운로드 시작
            <Input name="downloadStartsAt" type="datetime-local" defaultValue={defaults.downloadStartsAt} required />
          </FieldLabel>
          <FieldLabel>
            다운로드 종료
            <Input name="downloadEndsAt" type="datetime-local" defaultValue={defaults.downloadEndsAt} required />
          </FieldLabel>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <FieldLabel>
            사용 시작
            <Input name="usageStartsAt" type="datetime-local" defaultValue={defaults.usageStartsAt} required />
          </FieldLabel>
          <FieldLabel>
            사용 종료
            <Input name="usageEndsAt" type="datetime-local" defaultValue={defaults.usageEndsAt} required />
          </FieldLabel>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FieldLabel>
            월 발급 한도
            <Input name="monthlyIssueLimit" type="number" min={0} step={1} defaultValue={defaults.monthlyIssueLimit} placeholder="무제한" />
          </FieldLabel>
          <FieldLabel>
            회원별 총 보유/사용 제한
            <Input name="perMemberLimit" type="number" min={1} step={1} defaultValue={defaults.perMemberLimit} />
          </FieldLabel>
          <FieldLabel>
            현장 확인 PIN
            <Input
              name="onsitePassword"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              autoComplete="off"
              placeholder={mode === "edit" ? "변경 시 4자리 입력" : "4자리 숫자 입력"}
              aria-describedby={`partner-onsite-password-help-${mode}`}
            />
            <span id={`partner-onsite-password-help-${mode}`} className="text-xs font-normal text-muted-foreground">
              {mode === "edit"
                ? "변경하지 않으면 기존 PIN을 유지합니다. 숫자 4자리만 입력해 주세요."
                : "현장 확인형 쿠폰에 사용할 숫자 4자리 PIN입니다."}
            </span>
          </FieldLabel>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
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

        <FieldLabel>
          외부 링크
          <Input name="externalUrl" type="url" defaultValue={defaults.externalUrl} placeholder="https://..." />
        </FieldLabel>
        <FieldLabel>
          조건
          <Textarea name="terms" rows={4} defaultValue={defaults.terms} placeholder={"평일 점심 한정\n1일 1회 사용\n타 쿠폰 중복 불가"} />
        </FieldLabel>
        <FieldLabel>
          {mode === "edit" ? "파트너 코드 추가 목록(한 줄에 하나)" : "파트너 코드 목록(한 줄에 하나)"}
          <Textarea name="codePool" rows={4} placeholder="파트너가 전달한 쿠폰 코드를 붙여 넣으세요." />
        </FieldLabel>
        <Button type="submit" className="w-full justify-center sm:w-fit">
          {submitLabel}
        </Button>
      </form>
    </Card>
  );
}
