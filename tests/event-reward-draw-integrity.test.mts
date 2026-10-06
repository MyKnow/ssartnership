import assert from "node:assert/strict";
import test from "node:test";

type EventRewardsModule = typeof import("../src/lib/promotions/event-rewards.ts");
type DeliveryModule = typeof import("../src/lib/promotions/event-reward-delivery.ts");

const eventRewardsModulePromise = import(
  new URL("../src/lib/promotions/event-rewards.ts", import.meta.url).href
) as Promise<EventRewardsModule>;
const deliveryModulePromise = import(
  new URL("../src/lib/promotions/event-reward-delivery.ts", import.meta.url).href
) as Promise<DeliveryModule>;

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
  conditions: [],
  rules: [],
};

const plan = {
  seed: "seed-1",
  winnerCount: 1,
  candidateCount: 2,
  totalTickets: 3,
  winners: [
    {
      rank: 1,
      memberId: "member-a",
      displayName: "가",
      mmUsername: "a",
      year: 15,
      campus: "서울",
      ticketCount: 2,
    },
  ],
};

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };
type Call = { table: string; operation: string; payload?: unknown; filters: unknown[] };

/** Minimal PostgREST-like fake: each from() call consumes the next scripted result. */
function createFakeSupabase(results: QueryResult[]) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, operation: "select", filters: [] };
      calls.push(call);
      const builder = {
        insert(payload: unknown) {
          call.operation = "insert";
          call.payload = payload;
          return builder;
        },
        delete() {
          call.operation = "delete";
          return builder;
        },
        update(payload: unknown) {
          call.operation = "update";
          call.payload = payload;
          return builder;
        },
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return builder;
        },
        single() {
          return Promise.resolve(results.shift());
        },
        then(resolve: (value: QueryResult | undefined) => unknown) {
          return Promise.resolve(results.shift()).then(resolve);
        },
      };
      return builder;
    },
  };
  return { client, calls };
}

const drawRow = {
  id: "draw-1",
  event_slug: "signup-reward",
  status: "finalized",
  seed: "seed-1",
  winner_count: 1,
  candidate_count: 2,
  total_tickets: 3,
  google_form_url: "https://docs.google.com/forms/d/test",
  guide_path: "/events/signup-reward/winner-form",
  sent_notification_id: null,
  metadata: {},
  created_by_admin_id: null,
  created_at: "2026-05-13T00:00:00.000Z",
  finalized_at: "2026-05-13T00:00:00.000Z",
  sent_at: null,
  updated_at: "2026-05-13T00:00:00.000Z",
};

test("당첨자 저장이 실패하면 추첨 기록을 삭제해 재추첨을 막지 않는다", async () => {
  const { persistEventRewardDraw, EventRewardSafeError } = await eventRewardsModulePromise;
  const fake = createFakeSupabase([
    { data: drawRow, error: null },
    { data: null, error: { message: "insert failed", code: "23503" } },
    { data: null, error: null },
  ]);

  await assert.rejects(
    persistEventRewardDraw(fake.client as never, {
      campaign,
      plan,
      googleFormUrl: drawRow.google_form_url,
      finalizedAt: drawRow.finalized_at,
    }),
    (error: unknown) =>
      error instanceof EventRewardSafeError && /추첨을 되돌렸습니다/.test(error.message),
  );
  assert.deepEqual(
    fake.calls.map((call) => `${call.table}:${call.operation}`),
    [
      "event_reward_draws:insert",
      "event_reward_winners:insert",
      "event_reward_draws:delete",
    ],
  );
  assert.deepEqual(fake.calls[2]?.filters, [["id", "draw-1"]]);
});

test("추첨 기록 정리까지 실패하면 운영 확인이 필요하다고 알린다", async () => {
  const { persistEventRewardDraw, EventRewardSafeError } = await eventRewardsModulePromise;
  const fake = createFakeSupabase([
    { data: drawRow, error: null },
    { data: null, error: { message: "insert failed" } },
    { data: null, error: { message: "delete failed" } },
  ]);

  await assert.rejects(
    persistEventRewardDraw(fake.client as never, {
      campaign,
      plan,
      googleFormUrl: drawRow.google_form_url,
      finalizedAt: drawRow.finalized_at,
    }),
    (error: unknown) =>
      error instanceof EventRewardSafeError && /되돌리지 못했습니다/.test(error.message),
  );
});

test("후보가 없는 추첨은 저장하지 않는다", async () => {
  const { persistEventRewardDraw } = await eventRewardsModulePromise;
  const fake = createFakeSupabase([]);

  await assert.rejects(
    persistEventRewardDraw(fake.client as never, {
      campaign,
      plan: { ...plan, candidateCount: 0, totalTickets: 0, winners: [] },
      googleFormUrl: drawRow.google_form_url,
      finalizedAt: drawRow.finalized_at,
    }),
    /후보가 없어 추첨을 확정할 수 없습니다/,
  );
  assert.equal(fake.calls.length, 0);
});

test("당첨자 저장이 성공하면 확정 추첨을 그대로 돌려준다", async () => {
  const { persistEventRewardDraw } = await eventRewardsModulePromise;
  const fake = createFakeSupabase([
    { data: drawRow, error: null },
    {
      data: [
        {
          id: "winner-1",
          draw_id: "draw-1",
          event_slug: "signup-reward",
          member_id: "member-a",
          winner_rank: 1,
          ticket_count: 2,
          display_name: "가",
          mm_username: "a",
          year: 15,
          campus: "서울",
          notification_status: "pending",
          notification_sent_at: null,
          notification_error: null,
          created_at: drawRow.created_at,
          updated_at: drawRow.updated_at,
        },
      ],
      error: null,
    },
  ]);

  const draw = await persistEventRewardDraw(fake.client as never, {
    campaign,
    plan,
    googleFormUrl: drawRow.google_form_url,
    finalizedAt: drawRow.finalized_at,
  });

  assert.equal(draw.id, "draw-1");
  assert.deepEqual(draw.winners.map((winner) => winner.memberId), ["member-a"]);
  assert.equal(fake.calls.some((call) => call.operation === "delete"), false);
});

test("외부 채널로 한 번이라도 전달된 당첨자는 재발송 대상에서 제외한다", async () => {
  const {
    resolveEventRewardWinnerDeliveryOutcome,
    selectEventRewardNotificationTargets,
    summarizeEventRewardWinnerDeliveries,
  } = await deliveryModulePromise;

  assert.equal(resolveEventRewardWinnerDeliveryOutcome([]), "unreached");
  assert.equal(
    resolveEventRewardWinnerDeliveryOutcome([
      { channel: "mm", status: "failed", providerStatus: "failed" },
      { channel: "push", status: "sent" },
    ]),
    "reached",
  );
  assert.equal(
    resolveEventRewardWinnerDeliveryOutcome([
      { channel: "mm", status: "failed", providerStatus: "failed" },
      { channel: "push", status: "failed", providerStatus: "failed" },
    ]),
    "unreached",
  );
  assert.equal(
    resolveEventRewardWinnerDeliveryOutcome([{ channel: "in_app", status: "failed" }]),
    "unreached",
  );

  const memberIds = ["member-a", "member-b", "member-c"];
  const outcomes = summarizeEventRewardWinnerDeliveries(memberIds, [
    { notificationId: "n1", memberId: "member-a", channel: "mm", status: "sent" },
    { notificationId: "n1", memberId: "member-b", channel: "mm", status: "failed", providerStatus: "failed" },
    { notificationId: "n1", memberId: "member-c", channel: "push", status: "failed", providerStatus: "failed" },
    { notificationId: "n2", memberId: "member-c", channel: "mm", status: "sent" },
  ]);

  assert.deepEqual(selectEventRewardNotificationTargets(memberIds, outcomes), ["member-b"]);
  assert.deepEqual(selectEventRewardNotificationTargets(memberIds, null), memberIds);
});

test("당첨 안내 상태는 모든 당첨자 도달 여부로 계산한다", async () => {
  const { resolveEventRewardDrawDeliveryStatus } = await deliveryModulePromise;
  const memberIds = ["member-a", "member-b"];

  assert.equal(
    resolveEventRewardDrawDeliveryStatus(
      memberIds,
      new Map([["member-a", "reached"], ["member-b", "reached"]]),
    ),
    "sent",
  );
  assert.equal(
    resolveEventRewardDrawDeliveryStatus(
      memberIds,
      new Map([["member-a", "reached"], ["member-b", "unreached"]]),
    ),
    "partial_failed",
  );
  assert.equal(
    resolveEventRewardDrawDeliveryStatus(
      memberIds,
      new Map([["member-a", "unreached"], ["member-b", "unreached"]]),
    ),
    "failed",
  );
  assert.equal(resolveEventRewardDrawDeliveryStatus([], new Map()), "failed");
});

test("이전 발송 시도 id는 메타데이터 기록과 최신 발송 id를 합친다", async () => {
  const { getEventRewardNotificationAttemptIds } = await deliveryModulePromise;

  assert.deepEqual(
    getEventRewardNotificationAttemptIds({ sent_notification_id: null, metadata: null }),
    [],
  );
  assert.deepEqual(
    getEventRewardNotificationAttemptIds({ sent_notification_id: "n1", metadata: {} }),
    ["n1"],
  );
  assert.deepEqual(
    getEventRewardNotificationAttemptIds({
      sent_notification_id: "n2",
      metadata: { notificationAttemptIds: ["n1", "n2", 3, ""] },
    }),
    ["n1", "n2"],
  );
});
