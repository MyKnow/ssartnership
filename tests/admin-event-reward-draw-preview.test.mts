import assert from "node:assert/strict";
import test from "node:test";

type DrawPreviewModule =
  typeof import("../src/components/admin/event-rewards/draw-preview.ts");
type EventRewardsModule = typeof import("../src/lib/promotions/event-rewards.ts");

const drawPreviewModulePromise = import(
  new URL("../src/components/admin/event-rewards/draw-preview.ts", import.meta.url).href
) as Promise<DrawPreviewModule>;
const eventRewardsModulePromise = import(
  new URL("../src/lib/promotions/event-rewards.ts", import.meta.url).href
) as Promise<EventRewardsModule>;

const campaign = {
  slug: "signup-reward",
  title: "추첨권 이벤트",
  shortTitle: "추첨권",
  description: "테스트",
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
  ],
  rules: [],
};

async function buildOverview() {
  const { buildEventRewardAdminOverview } = await eventRewardsModulePromise;
  return buildEventRewardAdminOverview(campaign, [
    {
      id: "member-a",
      displayName: "가",
      mmUsername: "a",
      year: 15,
      campus: "서울",
      createdAt: "2026-04-01T00:00:00+09:00",
      preferences: null,
      reviewCount: 0,
    },
    {
      id: "member-b",
      displayName: "나",
      mmUsername: "b",
      year: 15,
      campus: "서울",
      createdAt: "2026-04-02T00:00:00+09:00",
      preferences: null,
      reviewCount: 0,
    },
  ]);
}

test("테스트 추첨 미리보기는 입력이 없으면 계산하지 않는다", async () => {
  const { getEventRewardDrawPreview } = await drawPreviewModulePromise;
  const overview = await buildOverview();

  assert.deepEqual(getEventRewardDrawPreview({ overview }), {
    plan: null,
    error: null,
  });
});

test("테스트 추첨 미리보기는 Seed 누락을 사용자 안내 오류로 돌려준다", async () => {
  const { getEventRewardDrawPreview } = await drawPreviewModulePromise;
  const overview = await buildOverview();

  const result = getEventRewardDrawPreview({ overview, winnerCount: "1", seed: " " });
  assert.equal(result.plan, null);
  assert.equal(result.error, "테스트 추첨 Seed를 확인해 주세요.");
});

test("테스트 추첨 미리보기는 같은 Seed로 확정 추첨과 같은 순서를 계산한다", async () => {
  const { getEventRewardDrawPreview } = await drawPreviewModulePromise;
  const { createEventRewardDrawPlan } = await eventRewardsModulePromise;
  const overview = await buildOverview();

  const preview = getEventRewardDrawPreview({
    overview,
    winnerCount: "1",
    seed: "stable-seed",
  });
  const plan = createEventRewardDrawPlan(overview, {
    winnerCount: 1,
    seed: "stable-seed",
  });

  assert.equal(preview.error, null);
  assert.deepEqual(
    preview.plan?.winners.map((winner) => winner.memberId),
    plan.winners.map((winner) => winner.memberId),
  );
});
