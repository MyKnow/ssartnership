import {
  ArrowRightIcon,
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  SparklesIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ShellHeader from "@/components/ui/ShellHeader";
import type { AvailableAdCoupon } from "@/lib/repositories/ad-package-repository";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

type CouponWalletSection = {
  id: "available";
  title: string;
  description: string;
  items: AvailableAdCoupon[];
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "만료일 미정";
  }
  return `${dateFormatter.format(date)}까지`;
}

function formatGlobalRemaining(value: number | null) {
  if (value === null) {
    return "전체 제한 없음";
  }
  return `전체 ${value.toLocaleString("ko-KR")}회 남음`;
}

function getNearestExpiryLabel(coupons: AvailableAdCoupon[]) {
  const nearest = coupons
    .map((item) => new Date(item.coupon.endsAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime())[0];

  if (!nearest) {
    return "만료 예정 없음";
  }

  return `${dateFormatter.format(nearest)}까지`;
}

function buildWalletSections(coupons: AvailableAdCoupon[]): CouponWalletSection[] {
  return [
    {
      id: "available",
      title: "사용 가능한 쿠폰",
      description: "제휴처 상세에서 쿠폰을 확인하고 사용할 수 있습니다.",
      items: coupons,
    },
  ];
}

function CouponWalletStats({ coupons }: { coupons: AvailableAdCoupon[] }) {
  const totalRemainingUses = coupons.reduce(
    (sum, item) => sum + item.remainingMemberUses,
    0,
  );
  const stats = [
    {
      label: "쿠폰",
      value: `${coupons.length.toLocaleString("ko-KR")}개`,
    },
    {
      label: "사용 가능",
      value: `${totalRemainingUses.toLocaleString("ko-KR")}회`,
    },
    {
      label: "가장 빠른 만료",
      value: getNearestExpiryLabel(coupons),
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-border/80 bg-surface px-4 py-3 shadow-flat"
        >
          <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
          <p className="mt-1 text-sm font-semibold text-foreground sm:text-base">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function CouponWalletAccordionItem({
  item,
  accordionName,
  defaultOpen = false,
}: {
  item: AvailableAdCoupon;
  accordionName: string;
  defaultOpen?: boolean;
}) {
  const { coupon, remainingGlobalUses, remainingMemberUses } = item;
  const detailHref = `/partners/${encodeURIComponent(coupon.partnerId)}#coupons`;

  return (
    <details
      className="group rounded-panel border border-border bg-surface shadow-flat transition hover:border-strong open:border-primary/30 open:bg-surface-elevated"
      name={accordionName}
      open={defaultOpen ? true : undefined}
    >
      <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-4 outline-none transition hover:bg-surface-muted/60 focus-visible:bg-surface-muted/60 focus-visible:ring-2 focus-visible:ring-primary/20 sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="success" className="tracking-normal">
              {coupon.discountLabel || "쿠폰"}
            </Badge>
            <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-xs font-semibold text-muted-foreground">
              <BuildingStorefrontIcon className="size-4 shrink-0" aria-hidden="true" />
              <span className="block min-w-0 truncate">{coupon.partnerName}</span>
            </span>
          </div>
          <h3 className="mt-3 truncate text-ko-title text-base font-semibold leading-7 text-foreground sm:text-lg">
            {coupon.title}
          </h3>
          <div className="mt-2 flex min-w-0 flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <TicketIcon className="size-4" aria-hidden="true" />
              내 {remainingMemberUses.toLocaleString("ko-KR")}회
            </span>
            <span className="inline-flex min-w-0 items-center gap-1">
              <CalendarDaysIcon className="size-4 shrink-0" aria-hidden="true" />
              <span className="block min-w-0 truncate">{formatDate(coupon.endsAt)}</span>
            </span>
          </div>
        </div>
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-border bg-surface-control text-muted-foreground transition group-open:rotate-180 group-open:border-primary/20 group-open:bg-primary-soft group-open:text-primary">
          <ChevronDownIcon className="size-5" aria-hidden="true" />
        </span>
      </summary>

      <div className="border-t border-border/70 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-3">
            {coupon.description ? (
              <p className="line-clamp-2 text-ko-pretty text-sm leading-6 text-muted-foreground">
                {coupon.description}
              </p>
            ) : (
              <p className="text-ko-pretty text-sm leading-6 text-muted-foreground">
                제휴처 상세에서 쿠폰 사용 방법을 확인해 주세요.
              </p>
            )}

            <div className="rounded-2xl border border-border/80 bg-surface-muted px-3 py-3">
              <p className="text-xs font-semibold text-muted-foreground">사용 조건</p>
              {coupon.terms.length > 0 ? (
                <ul className="mt-2 grid gap-1 text-xs leading-5 text-muted-foreground">
                  {coupon.terms.map((term) => (
                    <li key={term} className="line-clamp-2 text-ko-pretty">
                      - {term}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-ko-pretty text-xs leading-5 text-muted-foreground">
                  별도 사용 조건은 제휴처 상세를 확인해 주세요.
                </p>
              )}
            </div>
          </div>

          <div className="grid min-w-0 gap-2 rounded-2xl border border-border/80 bg-surface-inset px-3 py-3 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">내 남은 사용 횟수</p>
              <p className="mt-1 font-semibold text-foreground">
                {remainingMemberUses.toLocaleString("ko-KR")}회 남음
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">전체 잔여 수량</p>
              <p className="mt-1 font-semibold text-foreground">
                {formatGlobalRemaining(remainingGlobalUses)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">만료일</p>
              <p className="mt-1 inline-flex min-w-0 items-center gap-1 font-semibold text-foreground">
                <CalendarDaysIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="block min-w-0 truncate">{formatDate(coupon.endsAt)}</span>
              </p>
            </div>
            <Button href={detailHref} variant="primary" className="mt-1 w-full justify-center">
              제휴처 상세 보기
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </details>
  );
}

function CouponWalletEmpty() {
  return (
    <Card padding="lg" className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-border bg-surface-muted text-muted-foreground">
        <TicketIcon className="size-7" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-base font-semibold text-foreground">
        지금 사용할 수 있는 쿠폰이 없습니다.
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        새 쿠폰이 열리면 이곳에서 한 번에 확인할 수 있습니다.
      </p>
      <div className="mt-5 flex justify-center">
        <Button href="/" variant="secondary">
          홈으로 이동
        </Button>
      </div>
    </Card>
  );
}

function CouponWalletSectionView({ section }: { section: CouponWalletSection }) {
  if (section.items.length === 0) {
    return <CouponWalletEmpty />;
  }

  return (
    <section className="space-y-3" aria-labelledby={`coupon-wallet-${section.id}`}>
      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <SparklesIcon className="size-4" aria-hidden="true" />
            Coupon
          </p>
          <h2 id={`coupon-wallet-${section.id}`} className="mt-2 text-base font-semibold text-foreground">
            {section.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
        </div>
        <Badge variant="primary" className="w-fit tracking-normal">
          {section.items.length.toLocaleString("ko-KR")}개
        </Badge>
      </div>
      <div className="grid gap-3">
        {section.items.map((item, index) => (
          <CouponWalletAccordionItem
            key={item.coupon.id}
            accordionName={`coupon-wallet-${section.id}`}
            item={item}
            defaultOpen={index === 0}
          />
        ))}
      </div>
    </section>
  );
}

export default function CouponWalletView({
  coupons,
}: {
  coupons: AvailableAdCoupon[];
}) {
  const totalRemainingUses = coupons.reduce(
    (sum, item) => sum + item.remainingMemberUses,
    0,
  );
  const sections = buildWalletSections(coupons);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ShellHeader
        eyebrow="Coupon Wallet"
        title="쿠폰함"
        description="지금 내 계정으로 사용할 수 있는 제휴 쿠폰을 모아봅니다."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary" className="tracking-normal">
              {coupons.length.toLocaleString("ko-KR")}개 쿠폰
            </Badge>
            <Badge variant="neutral" className="tracking-normal">
              {totalRemainingUses.toLocaleString("ko-KR")}회 사용 가능
            </Badge>
          </div>
        }
      />
      <CouponWalletStats coupons={coupons} />
      {sections.map((section) => (
        <CouponWalletSectionView key={section.id} section={section} />
      ))}
    </div>
  );
}
