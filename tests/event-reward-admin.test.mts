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

test("event reward comparison csv marks unrecoverable before states as unknown", async () => {
  const {
    buildEventRewardComparisonOverview,
    createEventRewardComparisonCsv,
  } = await eventRewardsModulePromise;

  const overview = buildEventRewardComparisonOverview(campaign, [
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
        marketingEnabled: true,
      },
      reviewCount: 1,
    },
    {
      id: "member-2",
      displayName: "이싸피",
      mmUsername: "lee",
      year: 15,
      campus: "서울",
      createdAt: "2026-05-01T00:00:00+09:00",
      preferences: {
        enabled: false,
        mmEnabled: false,
        marketingEnabled: false,
      },
      reviewCount: 0,
    },
  ]);
  const csv = createEventRewardComparisonCsv(overview);

  assert.equal(overview.members[0]?.existedBeforeEvent, true);
  assert.equal(overview.members[1]?.joinedDuringEvent, true);
  assert.match(csv, /Before 추첨권\(확인가능\),After 추첨권,증감\(확인가능\)/);
  assert.match(csv, /확인불가/);
  assert.match(csv, /김싸피,kim,15,서울,Y,N,1,6,5,완료,확인불가,확인불가,확인불가,완료,완료,완료,완료,1/);
});

test("event reward weighted draw is deterministic and excludes zero-ticket members", async () => {
  const {
    buildEventRewardAdminOverview,
    createEventRewardDrawPlan,
  } = await eventRewardsModulePromise;
  const overview = buildEventRewardAdminOverview(campaign, [
    {
      id: "member-zero",
      displayName: "무응모",
      mmUsername: "zero",
      year: 15,
      campus: "서울",
      createdAt: "2026-05-13T00:00:00+09:00",
      preferences: null,
      reviewCount: 0,
    },
    {
      id: "member-one",
      displayName: "한장",
      mmUsername: "one",
      year: 15,
      campus: "서울",
      createdAt: "2026-04-01T00:00:00+09:00",
      preferences: null,
      reviewCount: 0,
    },
    {
      id: "member-five",
      displayName: "다섯장",
      mmUsername: "five",
      year: 15,
      campus: "서울",
      createdAt: "2026-04-01T00:00:00+09:00",
      preferences: {
        enabled: true,
        mmEnabled: true,
        marketingEnabled: true,
      },
      reviewCount: 1,
    },
  ]);

  const first = createEventRewardDrawPlan(overview, {
    winnerCount: 2,
    seed: "stable-seed",
  });
  const second = createEventRewardDrawPlan(overview, {
    winnerCount: 2,
    seed: "stable-seed",
  });

  assert.deepEqual(
    first.winners.map((winner) => winner.memberId),
    second.winners.map((winner) => winner.memberId),
  );
  assert.equal(first.candidateCount, 2);
  assert.equal(first.totalTickets, 7);
  assert.equal(new Set(first.winners.map((winner) => winner.memberId)).size, 2);
  assert.equal(
    first.winners.some((winner) => winner.memberId === "member-zero"),
    false,
  );
});

test("event reward draw input validates winner count and Google Forms URL", async () => {
  const {
    normalizeEventRewardDrawRequest,
  } = await eventRewardsModulePromise;

  assert.throws(
    () =>
      normalizeEventRewardDrawRequest({
        winnerCount: 0,
        googleFormUrl: "https://forms.gle/example",
      }),
    /당첨 인원/,
  );
  assert.throws(
    () =>
      normalizeEventRewardDrawRequest({
        winnerCount: 1,
        googleFormUrl: "https://example.com/form",
      }),
    /구글폼/,
  );
  assert.deepEqual(
    normalizeEventRewardDrawRequest({
      winnerCount: 1,
      seed: " seed ",
      googleFormUrl: "https://docs.google.com/forms/d/e/abc/viewform",
    }),
    {
      winnerCount: 1,
      seed: "seed",
      googleFormUrl: "https://docs.google.com/forms/d/e/abc/viewform",
    },
  );
});

test("winner form access only allows the winning signed-in member", async () => {
  const { canViewEventRewardWinnerForm } = await eventRewardsModulePromise;

  assert.equal(
    canViewEventRewardWinnerForm({
      memberId: null,
      winnerMemberIds: ["member-1"],
    }),
    false,
  );
  assert.equal(
    canViewEventRewardWinnerForm({
      memberId: "member-2",
      winnerMemberIds: ["member-1"],
    }),
    false,
  );
  assert.equal(
    canViewEventRewardWinnerForm({
      memberId: "member-1",
      winnerMemberIds: ["member-1"],
    }),
    true,
  );
});
