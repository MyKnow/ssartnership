import {
  ArrowRightIcon,
  BuildingStorefrontIcon,
  CalendarDaysIcon,
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

function CouponWalletCard({ item }: { item: AvailableAdCoupon }) {
  const { coupon, remainingGlobalUses, remainingMemberUses } = item;
  const detailHref = `/partners/${encodeURIComponent(coupon.partnerId)}#coupons`;

  return (
    <article className="grid gap-4 rounded-panel border border-border bg-surface p-4 shadow-flat sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success" className="tracking-normal">
              {coupon.discountLabel || "쿠폰"}
            </Badge>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <BuildingStorefrontIcon className="size-4" aria-hidden="true" />
              {coupon.partnerName}
            </span>
          </div>
          <h3 className="mt-3 text-base font-semibold leading-7 text-foreground sm:text-lg">
            {coupon.title}
          </h3>
          {coupon.description ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {coupon.description}
            </p>
          ) : null}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-primary/10 bg-primary-soft text-primary">
          <TicketIcon className="size-5" aria-hidden="true" />
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl border border-border/80 bg-surface-muted px-3 py-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">내 사용 가능</p>
          <p className="mt-1 font-semibold text-foreground">
            {remainingMemberUses.toLocaleString("ko-KR")}회 남음
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">전체 잔여</p>
          <p className="mt-1 font-semibold text-foreground">
            {formatGlobalRemaining(remainingGlobalUses)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">사용 기간</p>
          <p className="mt-1 inline-flex items-center gap-1 font-semibold text-foreground">
            <CalendarDaysIcon className="size-4" aria-hidden="true" />
            {formatDate(coupon.endsAt)}
          </p>
        </div>
      </div>

      {coupon.terms.length > 0 ? (
        <ul className="grid gap-1 text-xs leading-5 text-muted-foreground">
          {coupon.terms.map((term) => (
            <li key={term}>- {term}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex justify-end">
        <Button href={detailHref} variant="primary" className="w-full justify-center sm:w-auto">
          제휴처 상세 보기
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </article>
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
      <div className="grid gap-3 lg:grid-cols-2">
        {section.items.map((item) => (
          <CouponWalletCard key={item.coupon.id} item={item} />
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
