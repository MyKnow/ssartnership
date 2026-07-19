import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import Select from "@/components/ui/Select";
import StatsRow from "@/components/ui/StatsRow";
import Textarea from "@/components/ui/Textarea";
import { AD_PACKAGE_FORM_LIMITS } from "@/lib/ad-package-validation";
import type { AdCouponStatus } from "@/lib/ad-packages";
import type {
  AdCampaignWithStats,
  AdCoupon,
} from "@/lib/repositories/ad-package-repository";
import { cn } from "@/lib/cn";

type ServerAction = (formData: FormData) => void | Promise<void>;

const statusLabels: Record<AdCouponStatus, string> = {
  draft: "초안",
  active: "활성",
  paused: "일시중지",
  ended: "종료",
};

const statusBadgeClass: Record<AdCouponStatus, string> = {
  draft: "bg-surface-muted text-muted-foreground",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ended: "bg-surface-inset text-muted-foreground",
};

function toDateTimeLocal(date: Date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatIssueLimit(value: number | null) {
  return value === null ? "무제한" : `${value.toLocaleString("ko-KR")}회`;
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

function CouponStatusBadge({ status }: { status: AdCouponStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold",
        statusBadgeClass[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

export default function AdminPartnerCouponManager({
  partnerId,
  partnerName,
  campaigns,
  coupons,
  createCouponAction,
  canCreateCoupon = true,
}: {
  partnerId: string;
  partnerName: string;
  campaigns: AdCampaignWithStats[];
  coupons: AdCoupon[];
  createCouponAction: ServerAction;
  canCreateCoupon?: boolean;
}) {
  const now = new Date();
  const defaultStartsAt = toDateTimeLocal(now);
  const defaultEndsAt = toDateTimeLocal(
    new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  );
  const activeCouponCount = coupons.filter((coupon) => coupon.status === "active").length;
  const usedCount = coupons.reduce((sum, coupon) => sum + coupon.usedCount, 0);
  const campaignOptions = campaigns.filter((campaign) => campaign.partnerId === partnerId);

  return (
    <section className="grid min-w-0 gap-5" aria-label={`${partnerName} 쿠폰 관리`}>
      <SectionHeading
        title="제휴처 쿠폰"
        description="이 제휴처 상세 페이지에 노출될 쿠폰을 생성하고 운영 상태를 확인합니다."
        headingLevel="h2"
      />

      <StatsRow
        items={[
          { label: "전체 쿠폰", value: `${coupons.length}개`, hint: "이 제휴처 등록 쿠폰" },
          { label: "활성 쿠폰", value: `${activeCouponCount}개`, hint: "회원에게 노출 가능" },
          { label: "사용", value: `${usedCount}건`, hint: "누적 사용 횟수" },
        ]}
        minItemWidth="12rem"
      />

      {canCreateCoupon ? (
        <Card tone="elevated" className="grid min-w-0 gap-4">
        <div>
          <h3 id="partner-coupon-heading" className="text-lg font-semibold text-foreground">
            쿠폰 생성
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            제휴처를 바꾸지 않고 현재 상세 페이지의 쿠폰만 등록합니다.
          </p>
        </div>
        <form action={createCouponAction} className="grid min-w-0 gap-4">
          <input type="hidden" name="partnerId" value={partnerId} readOnly />
          <input type="hidden" name="startsAt" value={defaultStartsAt} readOnly />
          <input type="hidden" name="endsAt" value={defaultEndsAt} readOnly />

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <FieldLabel>
              제휴처
              <div className="flex h-11 min-w-0 items-center rounded-[1rem] border border-border bg-surface-inset px-3.5 text-sm text-foreground">
                <span className="truncate">{partnerName}</span>
              </div>
            </FieldLabel>
            <FieldLabel>
              캠페인
              <Select name="campaignId">
                <option value="">캠페인 없이 쿠폰만 등록</option>
                {campaignOptions.map((campaign) => (
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
              placeholder="예: 점심 세트 10% 할인"
            />
          </FieldLabel>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <FieldLabel>
              할인 표기
              <Input
                name="discountLabel"
                maxLength={AD_PACKAGE_FORM_LIMITS.discountLabelMax}
                placeholder="10% 할인"
              />
            </FieldLabel>
            <FieldLabel>
              쿠폰 코드
              <Input
                name="code"
                maxLength={AD_PACKAGE_FORM_LIMITS.codeMax}
                placeholder="SSAFY-LUNCH"
              />
            </FieldLabel>
          </div>

          <FieldLabel>
            설명
            <Textarea
              name="description"
              maxLength={AD_PACKAGE_FORM_LIMITS.descriptionMax}
              rows={3}
              placeholder="사용 가능 시간, 대상 메뉴, 매장 확인 방법"
            />
          </FieldLabel>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <FieldLabel>
              발급 방식
              <Select name="issuanceType" defaultValue="service">
                <option value="service">서비스 발급형</option>
                <option value="partner_code_pool">파트너 코드형</option>
              </Select>
            </FieldLabel>
            <FieldLabel>
              사용 방식
              <Select name="redemptionType" defaultValue="onsite">
                <option value="onsite">현장 확인</option>
                <option value="code">코드 제시</option>
                <option value="external">외부 링크</option>
              </Select>
            </FieldLabel>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <FieldLabel>
              다운로드 시작
              <Input name="downloadStartsAt" type="datetime-local" defaultValue={defaultStartsAt} required />
            </FieldLabel>
            <FieldLabel>
              다운로드 종료
              <Input name="downloadEndsAt" type="datetime-local" defaultValue={defaultEndsAt} required />
            </FieldLabel>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <FieldLabel>
              사용 시작
              <Input name="usageStartsAt" type="datetime-local" defaultValue={defaultStartsAt} required />
            </FieldLabel>
            <FieldLabel>
              사용 종료
              <Input name="usageEndsAt" type="datetime-local" defaultValue={defaultEndsAt} required />
            </FieldLabel>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FieldLabel>
              상태
              <Select name="status" defaultValue="draft">
                <option value="draft">초안</option>
                <option value="active">활성</option>
                <option value="paused">일시중지</option>
                <option value="ended">종료</option>
              </Select>
            </FieldLabel>
            <FieldLabel>
              일 발급 한도
              <Input name="dailyIssueLimit" type="number" min={0} step={1} placeholder="무제한" />
            </FieldLabel>
            <FieldLabel>
              주 발급 한도
              <Input name="weeklyIssueLimit" type="number" min={0} step={1} placeholder="무제한" />
            </FieldLabel>
            <FieldLabel>
              월 발급 한도
              <Input name="monthlyIssueLimit" type="number" min={0} step={1} placeholder="무제한" />
            </FieldLabel>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <FieldLabel>
              회원별 보유/사용 제한
              <Input name="perMemberLimit" type="number" min={1} step={1} defaultValue={1} />
            </FieldLabel>
            <FieldLabel>
              현장 확인 비밀번호
              <Input
                name="onsitePassword"
                type="text"
                inputMode="numeric"
                pattern="[0-9]+"
                autoComplete="off"
                placeholder="현장 확인형만 입력"
                aria-describedby="partner-onsite-password-help"
              />
              <span id="partner-onsite-password-help" className="text-xs font-normal text-muted-foreground">
                현장 확인형 쿠폰을 사용할 때 제휴처가 확인할 숫자 비밀번호입니다. 길이 제한은 없습니다.
              </span>
            </FieldLabel>
            <FieldLabel>
              외부 링크
              <Input name="externalUrl" type="url" placeholder="https://..." />
            </FieldLabel>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-3">
            <FieldLabel>
              회원별 일 발급 한도
              <Input name="perMemberDailyIssueLimit" type="number" min={0} step={1} placeholder="무제한" />
            </FieldLabel>
            <FieldLabel>
              회원별 주 발급 한도
              <Input name="perMemberWeeklyIssueLimit" type="number" min={0} step={1} placeholder="무제한" />
            </FieldLabel>
            <FieldLabel>
              회원별 월 발급 한도
              <Input name="perMemberMonthlyIssueLimit" type="number" min={0} step={1} placeholder="무제한" />
            </FieldLabel>
          </div>

          <FieldLabel>
            조건
            <Textarea name="terms" rows={4} placeholder={"평일 점심 한정\n1일 1회 사용\n타 쿠폰 중복 불가"} />
          </FieldLabel>
          <FieldLabel>
            파트너 코드 목록(한 줄에 하나)
            <Textarea name="codePool" rows={4} placeholder="파트너가 전달한 쿠폰 코드를 붙여 넣으세요." />
          </FieldLabel>
          <Button type="submit" className="w-full justify-center sm:w-fit">
            쿠폰 생성
          </Button>
        </form>
        </Card>
      ) : null}

      <section className="grid min-w-0 gap-4" aria-label={`${partnerName} 쿠폰 목록`}>
        {coupons.length === 0 ? (
          <Card tone="muted" className="text-sm text-muted-foreground">
            아직 이 제휴처에 등록된 쿠폰이 없습니다.
          </Card>
        ) : (
          coupons.map((coupon) => (
            <Card key={coupon.id} tone="default" className="grid min-w-0 gap-3">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CouponStatusBadge status={coupon.status} />
                    <span className="rounded-full border border-border bg-surface-inset px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {coupon.issuanceType === "partner_code_pool" ? "파트너 코드형" : "서비스 발급형"}
                    </span>
                    <span className="rounded-full border border-border bg-surface-inset px-3 py-1 text-xs font-medium text-muted-foreground">
                      {coupon.redemptionType === "onsite"
                        ? "현장 확인"
                        : coupon.redemptionType === "external"
                          ? "외부 링크"
                          : "코드 제시"}
                    </span>
                  </div>
                  <h3 className="mt-3 truncate text-lg font-semibold text-foreground" title={coupon.title}>
                    {coupon.title}
                  </h3>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {coupon.discountLabel || coupon.code || "할인 표기 없음"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    다운로드 {formatDateTime(coupon.downloadStartsAt)} - {formatDateTime(coupon.downloadEndsAt)}
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    회원별 발급 · 일 {formatIssueLimit(coupon.perMemberDailyIssueLimit)} · 주 {formatIssueLimit(coupon.perMemberWeeklyIssueLimit)} · 월 {formatIssueLimit(coupon.perMemberMonthlyIssueLimit)}
                  </p>
                  {coupon.redemptionType === "onsite" ? (
                    <p className="mt-1 text-xs font-medium text-primary">
                      {coupon.hasOnsitePassword ? "현장 확인 비밀번호 설정됨" : "현장 확인 비밀번호 미설정"}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 self-start rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                  {coupon.usedCount}
                  {coupon.usageLimit !== null ? `/${coupon.usageLimit}` : "회 사용"}
                </span>
              </div>
            </Card>
          ))
        )}
      </section>
    </section>
  );
}
