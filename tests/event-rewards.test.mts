import assert from "node:assert/strict";
import test from "node:test";

type EventRewardsModule = typeof import("../src/lib/promotions/event-rewards.ts");

const eventRewardsModulePromise = import(
  new URL("../src/lib/promotions/event-rewards.ts", import.meta.url).href
) as Promise<EventRewardsModule>;

const campaign = {
  slug: "signup-reward",
  title: "싸트너십 추첨권 이벤트",
  shortTitle: "추첨권 이벤트",
  description: "테스트 이벤트",
  periodLabel: "테스트 기간",
  startsAt: "2026-04-20T00:00:00+09:00",
  endsAt: "2026-05-12T23:59:59+09:00",
  heroImageSrc: "/ads/reward-event.svg",
  heroImageAlt: "이벤트",
  conditions: [
    {
      key: "signup" as const,
      title: "회원가입",
      description: "가입",
      tickets: 1,
      ctaHref: "/auth/signup",
      ctaLabel: "회원가입",
    },
    {
      key: "mm" as const,
      title: "MM",
      description: "MM",
      tickets: 1,
      ctaHref: "/notifications",
      ctaLabel: "알림",
    },
    {
      key: "push" as const,
      title: "Push",
      description: "Push",
      tickets: 1,
      ctaHref: "/notifications",
      ctaLabel: "푸시",
    },
    {
      key: "marketing" as const,
      title: "Marketing",
      description: "Marketing",
      tickets: 2,
      ctaHref: "/notifications",
      ctaLabel: "동의",
    },
    {
      key: "review" as const,
      title: "Review",
      description: "Review",
      tickets: 1,
      ctaHref: "/",
      ctaLabel: "리뷰",
      repeatable: true,
    },
  ],
  rules: [],
};

test("event reward signup condition includes members created before the campaign", async () => {
  const { calculateEventRewardConditions } = await eventRewardsModulePromise;

  const conditions = calculateEventRewardConditions(campaign, {
    createdAt: "2026-04-01T12:00:00+09:00",
    preferences: null,
    reviewCount: 0,
  });

  assert.equal(conditions.find((condition) => condition.key === "signup")?.status, "received");
  assert.equal(conditions.find((condition) => condition.key === "signup")?.earnedTickets, 1);
});

test("event reward signup condition excludes members created after the campaign", async () => {
  const { calculateEventRewardConditions } = await eventRewardsModulePromise;

  const conditions = calculateEventRewardConditions(campaign, {
    createdAt: "2026-05-13T00:00:00+09:00",
    preferences: {
      enabled: true,
      mmEnabled: true,
      marketingEnabled: true,
    },
    reviewCount: 3,
  });

  assert.equal(conditions.find((condition) => condition.key === "signup")?.status, "missing");
  assert.equal(conditions.find((condition) => condition.key === "signup")?.earnedTickets, 0);
});

test("event reward conditions sum signup, notification, marketing, and review tickets", async () => {
  const { calculateEventRewardConditions, sumEventRewardTickets } =
    await eventRewardsModulePromise;

  const conditions = calculateEventRewardConditions(campaign, {
    createdAt: "2026-05-01T12:00:00+09:00",
    preferences: {
      enabled: true,
      mmEnabled: false,
      marketingEnabled: true,
    },
    reviewCount: 2,
  });

  assert.equal(sumEventRewardTickets(conditions), 6);
  assert.deepEqual(
    conditions.map((condition) => [condition.key, condition.earnedTickets]),
    [
      ["signup", 1],
      ["mm", 0],
      ["push", 1],
      ["marketing", 2],
      ["review", 2],
    ],
  );
});
