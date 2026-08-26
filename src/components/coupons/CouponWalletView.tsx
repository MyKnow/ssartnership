"use client";

import {
  ArrowRightIcon,
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  SparklesIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useId, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ShellHeader from "@/components/ui/ShellHeader";
import { cn } from "@/lib/cn";
import type { AvailableAdCoupon } from "@/lib/repositories/ad-package-repository";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

type CouponWalletSection = {
  id: "available";
  title: string;
  items: AvailableAdCoupon[];
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "만료일 미정";
  }
  return `${dateFormatter.format(date)}까지`;
}

function buildWalletSections(coupons: AvailableAdCoupon[]): CouponWalletSection[] {
  return [
    {
      id: "available",
      title: "사용 가능한 쿠폰",
      items: coupons,
    },
  ];
}

function CouponWalletAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: AvailableAdCoupon;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { coupon, remainingMemberUses } = item;
  const assignedCode = item.assignedCode ?? coupon.code;
  const detailHref = `/partners/${encodeURIComponent(coupon.partnerId)}#coupons`;
  const hasTerms = coupon.terms.length > 0;
  const useHref =
    coupon.redemptionType === "onsite" && coupon.hasOnsitePassword && item.issueId
      ? `/coupons?issueId=${encodeURIComponent(item.issueId)}`
      : null;
  const contentId = useId();

  return (
    <article
      className={cn(
        "group relative rounded-panel border border-border bg-surface shadow-flat transition-surface duration-200 ease-out hover:border-strong hover:bg-surface-elevated hover-shadow-raised focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 focus-within:ring-offset-2 focus-within:ring-offset-background",
        isOpen ? "border-primary/30 bg-surface-elevated" : null,
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-controls={contentId}
        aria-expanded={isOpen}
        className="absolute inset-x-0 top-0 z-0 h-24 cursor-pointer rounded-t-panel outline-none"
      >
        <span className="sr-only">
          {coupon.title} 사용 조건 {isOpen ? "접기" : "펼치기"}
        </span>
      </button>
      <div className="pointer-events-none relative z-10 grid min-h-24 grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="success" className="tracking-normal">
              {coupon.discountLabel || "쿠폰"}
            </Badge>
            <Link
              href={detailHref}
              aria-label={`${coupon.partnerName} 제휴처 상세 보기`}
              className="pointer-events-auto -my-2 -ml-2 inline-flex min-h-11 min-w-0 max-w-full items-center gap-1 rounded-[0.875rem] px-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <BuildingStorefrontIcon className="size-4 shrink-0" aria-hidden="true" />
              <span className="block min-w-0 truncate">{coupon.partnerName}</span>
            </Link>
          </div>
          <h3 className="mt-3 truncate text-ko-title text-base font-semibold leading-7 text-foreground sm:text-lg">
            {coupon.title}
          </h3>
        </div>
        <span
          className={cn(
            "mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-border bg-surface-control text-muted-foreground transition",
            isOpen && "rotate-180 border-primary/20 bg-primary-soft text-primary",
          )}
        >
          <ChevronDownIcon className="size-5" aria-hidden="true" />
        </span>
      </div>

      <div id={contentId} hidden={!isOpen} className="px-4 pb-4 sm:px-5 sm:pb-5">
        <div className={hasTerms ? "grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]" : "grid gap-3"}>
          {hasTerms ? (
            <div className="min-w-0 space-y-3">
              {coupon.description ? (
                <p className="line-clamp-2 text-ko-pretty text-sm leading-6 text-muted-foreground">
                  {coupon.description}
                </p>
              ) : null}

              <div className="rounded-2xl border border-border/80 bg-surface-muted px-3 py-3">
                <p className="text-xs font-semibold text-muted-foreground">사용 조건</p>
                <ul className="mt-2 grid gap-1 text-xs leading-5 text-muted-foreground">
                  {coupon.terms.map((term) => (
                    <li key={term} className="line-clamp-2 text-ko-pretty">
                      - {term}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="grid min-w-0 gap-2 rounded-2xl border border-border/80 bg-surface-inset px-3 py-3 text-sm">
            {!hasTerms && coupon.description ? (
              <p className="line-clamp-2 text-ko-pretty text-sm leading-6 text-muted-foreground">
                {coupon.description}
              </p>
            ) : null}
            <div>
              <p className="text-xs font-medium text-muted-foreground">내 남은 사용 횟수</p>
              <p className="mt-1 font-semibold text-foreground">
                {remainingMemberUses.toLocaleString("ko-KR")}회 남음
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">만료일</p>
              <p className="mt-1 inline-flex min-w-0 items-center gap-1 font-semibold text-foreground">
                <CalendarDaysIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="block min-w-0 truncate">{formatDate(coupon.endsAt)}</span>
              </p>
            </div>
            {assignedCode ? (
              <div className="rounded-xl border border-dashed border-border bg-surface px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">내 쿠폰 코드</p>
                <p className="mt-1 break-all font-mono text-sm font-semibold text-foreground">
                  {assignedCode}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {useHref ? (
        <div className="relative z-10 px-4 pb-4 sm:px-5 sm:pb-5">
          <Button href={useHref} variant="primary" className="w-full justify-center">
            사용하기
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
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
  const [openCouponId, setOpenCouponId] = useState<string | null>(
    section.items[0]?.issueId ?? section.items[0]?.coupon.id ?? null,
  );

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
        </div>
        <Badge variant="primary" className="w-fit tracking-normal">
          {section.items.length.toLocaleString("ko-KR")}개
        </Badge>
      </div>
      <div className="grid gap-3">
        {section.items.map((item) => (
          <CouponWalletAccordionItem
            key={item.issueId ?? item.coupon.id}
            item={item}
            isOpen={openCouponId === (item.issueId ?? item.coupon.id)}
            onToggle={() => {
              const itemId = item.issueId ?? item.coupon.id;
              setOpenCouponId((current) => (current === itemId ? null : itemId));
            }}
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
  const sections = buildWalletSections(coupons);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ShellHeader
        eyebrow="Coupon Wallet"
        title="쿠폰함"
        description="지금 내 계정으로 사용할 수 있는 제휴 쿠폰을 모아봅니다."
      />
      {sections.map((section) => (
        <CouponWalletSectionView key={section.id} section={section} />
      ))}
    </div>
  );
}
