import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

type DrawAuditModule = typeof import("../src/lib/draw-audit.ts");
type ShowcaseDrawModule = typeof import("../src/lib/project-showcase/draw.ts");
type EventRewardsModule = typeof import("../src/lib/promotions/event-rewards.ts");

const drawAuditPromise = import(
  new URL("../src/lib/draw-audit.ts", import.meta.url).href
) as Promise<DrawAuditModule>;
const showcaseDrawPromise = import(
  new URL("../src/lib/project-showcase/draw.ts", import.meta.url).href
) as Promise<ShowcaseDrawModule>;
const eventRewardsPromise = import(
  new URL("../src/lib/promotions/event-rewards.ts", import.meta.url).href
) as Promise<EventRewardsModule>;

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("후보 스냅샷 해시는 순서를 포함한 id:가중치 목록의 SHA-256이다", async () => {
  const { buildDrawCandidateSnapshotSha256 } = await drawAuditPromise;
  const entries = [
    { id: "member-a", weight: 2 },
    { id: "member-b", weight: 1 },
  ];
  const expected = createHash("sha256").update("member-a:2\nmember-b:1\n").digest("hex");

  assert.equal(buildDrawCandidateSnapshotSha256(entries), expected);
  assert.notEqual(buildDrawCandidateSnapshotSha256([...entries].reverse()), expected);
});

test("추첨 감사 요약은 두 추첨 시스템에서 같은 로그 키를 만든다", async () => {
  const { buildDrawAuditSummary, toDrawAuditLogProperties, DRAW_AUDIT_CONTRACT_VERSION } =
    await drawAuditPromise;
  const summary = buildDrawAuditSummary({
    algorithm: "test-v1",
    seedSource: "generated",
    entries: [
      { id: "a", weight: 2 },
      { id: "b", weight: 3 },
    ],
  });

  assert.equal(summary.contractVersion, DRAW_AUDIT_CONTRACT_VERSION);
  assert.equal(summary.candidateCount, 2);
  assert.equal(summary.ticketCount, 5);
  assert.deepEqual(Object.keys(toDrawAuditLogProperties(summary)).sort(), [
    "candidate_count",
    "candidate_snapshot_sha256",
    "draw_algorithm",
    "draw_audit_version",
    "seed_source",
    "ticket_count",
  ]);
});

test("쇼케이스 추첨 감사는 CSPRNG 비재현임을 기록하고 출품 표본·추첨권을 요약한다", async () => {
  const { buildShowcaseExperiencerDrawAudit, buildShowcaseSubmitterDrawAudit } =
    await showcaseDrawPromise;

  const submitter = buildShowcaseSubmitterDrawAudit([
    { projectId: "p1", memberId: "m1" },
    { projectId: "p2", memberId: "m1" },
    { projectId: "p3", memberId: "m2" },
  ]);
  assert.equal(submitter.seedSource, "csprng");
  assert.equal(submitter.candidateCount, 2);
  assert.equal(submitter.ticketCount, 3);

  const experiencer = buildShowcaseExperiencerDrawAudit([
    { memberId: "m1", tickets: 2 },
    { memberId: "m2", tickets: 1 },
  ]);
  assert.equal(experiencer.seedSource, "csprng");
  assert.equal(experiencer.candidateCount, 2);
  assert.equal(experiencer.ticketCount, 3);
});

test("이벤트 보상 추첨 감사는 Seed 출처와 추첨 후보 순서를 기록한다", async () => {
  const { buildEventRewardAdminOverview, buildEventRewardDrawAudit, createEventRewardDrawPlan } =
    await eventRewardsPromise;
  const overview = buildEventRewardAdminOverview(
    {
      slug: "signup-reward",
      title: "추첨권 이벤트",
      shortTitle: "추첨권",
      description: "테스트",
      periodLabel: "테스트",
      startsAt: "2026-04-20T00:00:00+09:00",
      endsAt: "2026-05-12T23:59:59+09:00",
      heroImageSrc: "/ads/reward-event.svg",
      heroImageAlt: "이벤트",
      conditions: [
        {
          key: "signup",
          title: "회원가입",
          description: "가입",
          tickets: 1,
          ctaHref: "/auth/signup",
          ctaLabel: "회원가입",
        },
      ],
      rules: [],
    },
    [
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
        id: "member-late",
        displayName: "늦음",
        mmUsername: "late",
        year: 15,
        campus: "서울",
        createdAt: "2026-06-01T00:00:00+09:00",
        preferences: null,
        reviewCount: 0,
      },
    ],
  );

  const audit = buildEventRewardDrawAudit(overview, "admin");
  const plan = createEventRewardDrawPlan(overview, { winnerCount: 1, seed: "seed" });

  assert.equal(audit.seedSource, "admin");
  assert.equal(audit.algorithm, "sha256-seeded-weighted-v1");
  assert.equal(audit.candidateCount, plan.candidateCount);
  assert.equal(audit.ticketCount, plan.totalTickets);
});

test("두 추첨 액션은 같은 감사 로그 키를 남기고 이벤트 추첨은 감사 요약을 메타데이터에 저장한다", async () => {
  const [promotionActions, showcaseActions, eventRewards, supabaseRepository, mockRepository] =
    await Promise.all([
      read("src/app/admin/(protected)/_actions/promotion-actions.ts"),
      read("src/app/admin/(protected)/events/project-showcase/actions.ts"),
      read("src/lib/promotions/event-rewards.ts"),
      read("src/lib/project-showcase/repository.supabase.ts"),
      read("src/lib/project-showcase/repository.mock.ts"),
    ]);

  assert.match(promotionActions, /seedSource: seed \? "admin" : "generated"/);
  assert.match(promotionActions, /\.\.\.toDrawAuditLogProperties\(draw\.audit\)/);
  assert.equal(showcaseActions.match(/\.\.\.toDrawAuditLogProperties\(receipt\.audit\)/g)?.length, 2);
  assert.match(eventRewards, /\.\.\.\(params\.audit \? \{ audit: params\.audit \} : \{\}\)/);
  for (const repository of [supabaseRepository, mockRepository]) {
    assert.match(repository, /buildShowcaseSubmitterDrawAudit\(eligible\)/);
    assert.match(repository, /buildShowcaseExperiencerDrawAudit\(eligible\)/);
  }
});
