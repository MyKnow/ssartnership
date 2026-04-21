import {
  BellAlertIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  GiftIcon,
  MegaphoneIcon,
  PencilSquareIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { EventCampaign, EventConditionKey } from "@/lib/promotions/catalog";
import type { EventRewardSummary } from "@/lib/promotions/event-rewards";

const conditionIcons: Record<EventConditionKey, typeof UserPlusIcon> = {
  signup: UserPlusIcon,
  mm: ChatBubbleLeftRightIcon,
  push: BellAlertIcon,
  marketing: MegaphoneIcon,
  review: PencilSquareIcon,
};

export default function EventLanding({
  campaign,
  summary,
}: {
  campaign: EventCampaign;
  summary: EventRewardSummary;
}) {
  const summaryMap = new Map(summary.conditions.map((condition) => [condition.key, condition]));

  return (
    <div className="space-y-5">
      <Card tone="hero" padding="none" className="overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="p-6 sm:p-8 lg:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] opacity-80">
              Event
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              {campaign.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 opacity-85 sm:text-base">
              {campaign.description}
            </p>
            <p className="mt-4 text-sm font-semibold opacity-90">{campaign.periodLabel}</p>
          </div>
          <div className="relative min-h-48 border-t border-white/10 bg-black/15 lg:border-l lg:border-t-0">
            <Image
              src={campaign.heroImageSrc}
              alt={campaign.heroImageAlt}
              fill
              priority
              sizes="(min-width: 1024px) 384px, calc(100vw - 32px)"
              className="object-cover"
            />
          </div>
        </div>
      </Card>

      <Card tone="elevated" className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <p className="text-sm font-semibold text-primary">현재 보유 추첨권</p>
          <p className="mt-1 text-sm text-muted-foreground">
            로그인한 회원 기준으로 현재 충족된 조건을 계산합니다.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3">
          <GiftIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          <p className="text-2xl font-semibold text-foreground">{summary.totalTickets}장</p>
        </div>
      </Card>

      {!summary.authenticated ? (
        <Card tone="muted" padding="md" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <p className="text-sm text-muted-foreground">
            로그인하면 현재 보유 추첨권과 조건별 수령 상태를 확인할 수 있습니다.
          </p>
          <Button href="/auth/login">로그인</Button>
        </Card>
      ) : null}

      <section className="grid gap-3" aria-label="이벤트 참여 조건">
        {campaign.conditions.map((condition) => {
          const conditionSummary = summaryMap.get(condition.key);
          const Icon = conditionIcons[condition.key];
          const received = conditionSummary?.status === "received";
          const earnedTickets = conditionSummary?.earnedTickets ?? 0;
          const reviewCount = conditionSummary?.currentCount;

          return (
            <Card
              key={condition.key}
              tone={received ? "elevated" : "default"}
              padding="md"
              className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-border/70 bg-surface-inset">
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">
                    {condition.title}
                  </h2>
                  <span className="rounded-full border border-border/70 bg-surface-inset px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {condition.repeatable ? `1개당 ${condition.tickets}장` : `${condition.tickets}장`}
                  </span>
                  {received ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                      <CheckCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      받음
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {condition.description}
                </p>
                {condition.key === "review" ? (
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    현재 인정 리뷰 {reviewCount ?? 0}개 · 추첨권 {earnedTickets}장
                  </p>
                ) : null}
              </div>
              <Button
                href={condition.ctaHref}
                variant={received ? "secondary" : "primary"}
                className="w-full sm:w-auto"
              >
                {received ? "확인하기" : condition.ctaLabel}
              </Button>
            </Card>
          );
        })}
      </section>

      <Card tone="muted" padding="md">
        <h2 className="text-base font-semibold text-foreground">이벤트 유의사항</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          {campaign.rules.map((rule) => (
            <li key={rule}>- {rule}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
