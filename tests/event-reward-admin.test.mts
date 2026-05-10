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

test("event reward admin overview aggregates member rows and condition counts", async () => {
  const { buildEventRewardAdminOverview } = await eventRewardsModulePromise;

  const overview = buildEventRewardAdminOverview(campaign, [
    {
      id: "member-1",
      displayName: "김싸피",
      mmUsername: "kim",
      year: 15,
      campus: "서울",
      createdAt: "2026-04-01T00:00:00+09:00",
      preferences: {
        enabled: true,
        mmEnabled: true,
        marketingEnabled: false,
      },
      reviewCount: 2,
    },
    {
      id: "member-2",
      displayName: "이싸피",
      mmUsername: "lee",
      year: 14,
      campus: "구미",
      createdAt: "2026-05-13T00:00:00+09:00",
      preferences: {
        enabled: false,
        mmEnabled: false,
        marketingEnabled: true,
      },
      reviewCount: 0,
    },
  ]);

  assert.equal(overview.memberCount, 2);
  assert.equal(overview.totalTickets, 7);
  assert.equal(overview.conditionCounts.signup, 1);
  assert.equal(overview.conditionCounts.mm, 1);
  assert.equal(overview.conditionCounts.push, 1);
  assert.equal(overview.conditionCounts.marketing, 1);
  assert.equal(overview.reviewCount, 2);
  assert.equal(overview.members[0]?.totalTickets, 5);
  assert.equal(overview.members[1]?.totalTickets, 2);
});

test("event reward csv export uses the same row values as admin overview", async () => {
  const { buildEventRewardAdminOverview, createEventRewardCsv } =
    await eventRewardsModulePromise;

  const overview = buildEventRewardAdminOverview(campaign, [
    {
      id: "member-1",
      displayName: "김,싸피",
      mmUsername: "kim",
      year: 15,
      campus: "서울",
      createdAt: "2026-04-01T00:00:00+09:00",
      preferences: {
        enabled: true,
        mmEnabled: false,
        marketingEnabled: true,
      },
      reviewCount: 1,
    },
  ]);
  const csv = createEventRewardCsv(overview);

  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /이름,MM ID,기수,캠퍼스,총 추첨권/);
  assert.match(csv, /"김,싸피",kim,15,서울,5,완료,미완료,완료,완료,1/);
});
