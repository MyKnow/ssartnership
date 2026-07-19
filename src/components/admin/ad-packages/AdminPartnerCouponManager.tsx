import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import StatsRow from "@/components/ui/StatsRow";
import type { AdCouponStatus } from "@/lib/ad-packages";
import type {
  AdCampaignWithStats,
  AdCoupon,
} from "@/lib/repositories/ad-package-repository";
import { cn } from "@/lib/cn";
import AdminPartnerCouponForm from "./AdminPartnerCouponForm";

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatIssueLimit(value: number | null) {
  return value === null ? "무제한" : `${value.toLocaleString("ko-KR")}회`;
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

function CouponManagementActions({
  coupon,
  partnerId,
  campaigns,
  updateCouponAction,
  duplicateCouponAction,
  deleteCouponAction,
  canUpdateCoupon,
  canCreateCoupon,
  canDeleteCoupon,
  partnerName,
}: {
  coupon: AdCoupon;
  partnerId: string;
  campaigns: AdCampaignWithStats[];
  updateCouponAction?: ServerAction;
  duplicateCouponAction?: ServerAction;
  deleteCouponAction?: ServerAction;
  canUpdateCoupon: boolean;
  canCreateCoupon: boolean;
  canDeleteCoupon: boolean;
  partnerName: string;
}) {
  if (!canUpdateCoupon && !canCreateCoupon && !canDeleteCoupon) {
    return null;
  }

  return (
    <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:justify-end">
      {canUpdateCoupon && updateCouponAction ? (
        <details className="min-w-0">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-center rounded-[0.95rem] border border-border bg-surface-control px-4 text-sm font-semibold text-foreground transition-interactive hover:border-strong hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 [&::-webkit-details-marker]:hidden">
            수정
          </summary>
          <div className="mt-3 min-w-0 sm:min-w-[min(42rem,calc(100vw-3rem))]">
            <AdminPartnerCouponForm
              partnerId={partnerId}
              partnerName={partnerName}
              campaigns={campaigns}
              action={updateCouponAction}
              mode="edit"
              coupon={coupon}
              title={`${coupon.title} 수정`}
              description="기존 PIN을 바꾸지 않으면 입력하지 않은 상태로 저장할 수 있습니다."
              submitLabel="쿠폰 수정"
            />
          </div>
        </details>
      ) : null}
      {canCreateCoupon && duplicateCouponAction ? (
        <form action={duplicateCouponAction}>
          <input type="hidden" name="partnerId" value={partnerId} readOnly />
          <input type="hidden" name="couponId" value={coupon.id} readOnly />
          <Button type="submit" variant="soft" className="w-full justify-center sm:w-auto">
            복제
          </Button>
        </form>
      ) : null}
      {canDeleteCoupon && deleteCouponAction ? (
        <form action={deleteCouponAction}>
          <input type="hidden" name="partnerId" value={partnerId} readOnly />
          <input type="hidden" name="couponId" value={coupon.id} readOnly />
          <Button type="submit" variant="danger" className="w-full justify-center sm:w-auto">
            삭제
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export default function AdminPartnerCouponManager({
  partnerId,
  partnerName,
  campaigns,
  coupons,
  createCouponAction,
  updateCouponAction,
  duplicateCouponAction,
  deleteCouponAction,
  canCreateCoupon = true,
  canUpdateCoupon = false,
  canDeleteCoupon = false,
}: {
  partnerId: string;
  partnerName: string;
  campaigns: AdCampaignWithStats[];
  coupons: AdCoupon[];
  createCouponAction: ServerAction;
  updateCouponAction?: ServerAction;
  duplicateCouponAction?: ServerAction;
  deleteCouponAction?: ServerAction;
  canCreateCoupon?: boolean;
  canUpdateCoupon?: boolean;
  canDeleteCoupon?: boolean;
}) {
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
        <AdminPartnerCouponForm
          partnerId={partnerId}
          partnerName={partnerName}
          campaigns={campaignOptions}
          action={createCouponAction}
          mode="create"
          title="쿠폰 생성"
          description="제휴처를 바꾸지 않고 현재 상세 페이지의 쿠폰만 등록합니다."
          submitLabel="쿠폰 생성"
        />
      ) : null}

      <section className="grid min-w-0 gap-4" aria-label={`${partnerName} 쿠폰 목록`}>
        {coupons.length === 0 ? (
          <Card tone="muted" className="text-sm text-muted-foreground">
            아직 이 제휴처에 등록된 쿠폰이 없습니다.
          </Card>
        ) : (
          coupons.map((coupon) => (
            <Card key={coupon.id} tone="default" className="grid min-w-0 gap-3 overflow-hidden">
              <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
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
                      {coupon.hasOnsitePassword ? "현장 확인 PIN 설정됨" : "현장 확인 PIN 미설정"}
                    </p>
                  ) : null}
                </div>
                <div className="grid min-w-0 gap-3 xl:min-w-[13rem] xl:justify-items-end">
                  <span className="justify-self-start rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary xl:justify-self-end">
                    {coupon.usedCount}
                    {coupon.usageLimit !== null ? `/${coupon.usageLimit}` : "회 사용"}
                  </span>
                  <CouponManagementActions
                    coupon={coupon}
                    partnerId={partnerId}
                    partnerName={partnerName}
                    campaigns={campaignOptions}
                    updateCouponAction={updateCouponAction}
                    duplicateCouponAction={duplicateCouponAction}
                    deleteCouponAction={deleteCouponAction}
                    canUpdateCoupon={canUpdateCoupon}
                    canCreateCoupon={canCreateCoupon}
                    canDeleteCoupon={canDeleteCoupon}
                  />
                </div>
              </div>
            </Card>
          ))
        )}
      </section>
    </section>
  );
}
