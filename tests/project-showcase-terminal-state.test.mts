import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { beforeEach, describe } from "node:test";

process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";

type StatusModule = typeof import("../src/lib/project-showcase/status");
type ErrorsModule = typeof import("../src/lib/project-showcase/errors");
type ValidationModule = typeof import("../src/lib/project-showcase/validation");
type MockRepositoryModule = typeof import("../src/lib/project-showcase/repository.mock");

const status = await (import(new URL("../src/lib/project-showcase/status.ts", import.meta.url).href) as Promise<StatusModule>);
const errors = await (import(new URL("../src/lib/project-showcase/errors.ts", import.meta.url).href) as Promise<ErrorsModule>);
const validation = await (import(new URL("../src/lib/project-showcase/validation.ts", import.meta.url).href) as Promise<ValidationModule>);
const mock = await (import(new URL("../src/lib/project-showcase/repository.mock.ts", import.meta.url).href) as Promise<MockRepositoryModule>);

const root = new URL("..", import.meta.url);
const MIGRATION = "20261005030746_harden_privileges_retention_and_lifecycle.sql";
const DAY = 24 * 60 * 60 * 1000;
const IMAGE_ID = "ad6e43a7-962f-4c54-89f3-4d2a13968356";

describe("쇼케이스 출품 상태 전이", () => {
  test("출품자가 취소한 프로젝트만 종료 상태로 고정한다", () => {
    assert.equal(status.canTransitionShowcaseProjectStatus("withdrawn", "approved"), false);
    assert.equal(status.canTransitionShowcaseProjectStatus("withdrawn", "withdrawn"), true);
    assert.equal(status.canTransitionShowcaseProjectStatus("rejected", "approved"), true);
    assert.equal(status.canTransitionShowcaseProjectStatus("approved", "withdrawn"), true);
    assert.deepEqual(status.getShowcaseAdminStatusOptions("withdrawn"), ["withdrawn"]);
    assert.equal(status.getShowcaseAdminStatusOptions("pending").length, 6);
    assert.equal(status.getShowcaseAdminStatusOptions(null).length, 6);
  });

  test("정산은 발표 시작 뒤 경품이 있는 분야의 첫 추첨을 모두 마쳐야 한다", () => {
    const now = Date.UTC(2026, 9, 5);
    const event = {
      announcementStartAt: new Date(now - DAY).toISOString(),
      submitterSelectionCount: 20,
      experiencerSelectionCount: 25,
    };
    const drawn = { submitterDrawn: true, experiencerDrawn: true, settledAt: null };
    assert.equal(status.getShowcaseSettlementBlocker(event, drawn, now), null);
    assert.equal(status.getShowcaseSettlementBlocker(event, { ...drawn, settledAt: new Date(now).toISOString() }, now), "settled");
    assert.equal(
      status.getShowcaseSettlementBlocker({ ...event, announcementStartAt: new Date(now + DAY).toISOString() }, drawn, now),
      "announcement_not_started",
    );
    assert.equal(status.getShowcaseSettlementBlocker(event, { ...drawn, submitterDrawn: false }, now), "submitter_draw_required");
    assert.equal(status.getShowcaseSettlementBlocker(event, { ...drawn, experiencerDrawn: false }, now), "experiencer_draw_required");
    // A group without prizes cannot be drawn, so it never blocks settlement.
    assert.equal(
      status.getShowcaseSettlementBlocker({ ...event, experiencerSelectionCount: 0 }, { ...drawn, experiencerDrawn: false }, now),
      null,
    );
    assert.equal(status.isShowcaseSettlementOverdue(event, { settledAt: null }, now), true);
    assert.equal(status.isShowcaseSettlementOverdue(event, { settledAt: new Date(now).toISOString() }, now), false);
    assert.equal(status.isShowcaseSettlementOverdue({ ...event, announcementStartAt: null }, { settledAt: null }, now), false);
  });

  test("DB 종료 상태 예외는 공용 에러 코드와 안내 문구로 바뀐다", () => {
    assert.equal(errors.showcaseErrorCodeFromDatabase("showcase_event_settled"), "event_settled");
    assert.equal(errors.showcaseErrorCodeFromDatabase("showcase_settlement_draw_required"), "settlement_draw_required");
    assert.equal(errors.showcaseErrorCodeFromDatabase("showcase_status_transition_invalid"), "status_transition_invalid");
    assert.equal(errors.SHOWCASE_ERROR_MESSAGES.status_transition_invalid.field, "status");
    assert.equal(status.SHOWCASE_SETTLED_LOCK_MESSAGE, errors.SHOWCASE_ERROR_MESSAGES.event_settled.message);
  });
});

describe("mock Repository 종료 상태 가드", () => {
  const repository = new mock.MockProjectShowcaseRepository();
  const OWNER = "terminal-owner";
  let store: ReturnType<typeof mock.resetProjectShowcaseMockStore>;

  function adminSubmission() {
    const parsed = validation.parseShowcaseAdminProjectSubmission({
      projectType: "web",
      title: "종료 상태 점검",
      teamName: "",
      summary: "정산 뒤 변경을 막는지 확인해요.",
      description: "정산을 마친 이벤트에서 출품·검수·삭제가 모두 거절되는지 확인하는 프로젝트입니다.",
      serviceUrl: "https://terminal.example.test",
      imageUploadId: IMAGE_ID,
      announcementConsent: true,
      status: "approved",
      reviewNote: "",
      allowImmediateFeedback: false,
    }, { requireImage: true, requireConsent: true });
    if (!parsed.success) throw new Error(parsed.message);
    return parsed.data;
  }

  async function expectCode(promise: Promise<unknown>, code: string) {
    await assert.rejects(promise, (error: unknown) => error instanceof errors.ShowcaseDomainError && error.code === code);
  }

  beforeEach(() => {
    store = mock.resetProjectShowcaseMockStore({ memberNames: { [OWNER]: "종료 점검" } });
  });

  test("취소한 출품은 관리자 수정으로 다시 승인할 수 없다", async () => {
    const data = adminSubmission();
    await repository.createAdminProject({
      projectId: "terminal-project",
      eventId: store.event.id,
      adminId: "admin",
      ownerMemberId: OWNER,
      ownerName: "종료 점검",
      submission: data.submission,
      imageUrl: "https://images.example.test/terminal.webp",
      status: "withdrawn",
      reviewNote: "",
      allowImmediateFeedback: false,
    });
    await expectCode(repository.updateAdminProject({
      projectId: "terminal-project",
      eventId: store.event.id,
      adminId: "admin",
      submission: data.submission,
      imageUrl: null,
      status: "approved",
      reviewNote: "",
      allowImmediateFeedback: false,
    }), "status_transition_invalid");
    assert.equal((await repository.getAdminProject("terminal-project"))?.status, "withdrawn");
  });

  test("정산 뒤에는 일정·출품·검수·삭제를 모두 거절한다", async () => {
    const [project] = await repository.listAdminProjects("approved");
    assert.ok(project);
    store.settledAt = new Date(Date.now() - DAY).toISOString();
    const data = adminSubmission();

    await expectCode(repository.updateEventSchedule({ ...store.event, isActive: false }), "event_settled");
    await expectCode(repository.reviewProject({ projectId: project.id, adminId: "admin", status: "hidden", reviewNote: "" }), "event_settled");
    await expectCode(repository.setImmediateFeedback({ projectId: project.id, allowed: true }), "event_settled");
    await expectCode(repository.createAdminProject({
      projectId: "late-project",
      eventId: store.event.id,
      adminId: "admin",
      ownerMemberId: OWNER,
      ownerName: "종료 점검",
      submission: data.submission,
      imageUrl: "https://images.example.test/late.webp",
      status: "approved",
      reviewNote: "",
      allowImmediateFeedback: false,
    }), "event_settled");
    await expectCode(repository.updateAdminProject({
      projectId: project.id,
      eventId: store.event.id,
      adminId: "admin",
      submission: data.submission,
      imageUrl: null,
      status: "hidden",
      reviewNote: "",
      allowImmediateFeedback: false,
    }), "event_settled");
    await expectCode(repository.deleteAdminProject({ projectId: project.id, adminId: "admin" }), "event_settled");
    assert.equal((await repository.getAdminProject(project.id))?.status, "approved");
  });
});

test("SQL은 정산 뒤 체험·출품 재개와 출품 변경을 막고 파기 실행을 감사 기록에 남긴다", async () => {
  const migration = await readFile(new URL(`supabase/migrations/${MIGRATION}`, root), "utf8");
  for (const assertion of ["showcase_assert_submission_open", "showcase_assert_experience_open"]) {
    const start = migration.indexOf(`create or replace function public.${assertion}(p_event_id uuid)`);
    assert.notEqual(start, -1, assertion);
    assert.match(migration.slice(start, migration.indexOf("\n$$;", start)), /and event_row\.settled_at is null/u);
  }
  assert.match(migration, /create trigger showcase_events_guard_settled\s+before update on public\.showcase_events/u);
  assert.match(migration, /create trigger showcase_projects_guard_mutation\s+before insert or update or delete on public\.showcase_projects/u);
  assert.match(migration, /if old\.status = 'withdrawn' and new\.status <> 'withdrawn' then\s+raise exception 'showcase_status_transition_invalid';/u);
  assert.match(migration, /array\['owner_member_id', 'image_upload_id', 'reviewed_by_admin_id', 'updated_at'\]/u);
  assert.match(migration, /raise exception 'showcase_settlement_draw_required';/u);
  assert.match(migration, /event_row\.submitter_selection_count > 0\s+and not exists/u);
  assert.match(migration, /event_row\.experiencer_selection_count > 0\s+and not exists/u);
  assert.match(
    migration,
    /insert into public\.admin_audit_logs \(\s+actor_type, actor_id, action, path, target_type, target_id, properties\s+\) values \(\s+'system', 'system', 'showcase_personal_data_purge'/u,
  );

  const catalog = await readFile(new URL("src/lib/event-catalog.ts", root), "utf8");
  assert.match(catalog, /'showcase_personal_data_purge',/u);
});

test("관리자 화면은 같은 종료 상태 규칙으로 폼을 잠그고 정산 버튼 사유를 정한다", async () => {
  const [draw, page, form, settings] = await Promise.all([
    readFile(new URL("src/app/admin/(protected)/events/project-showcase/draw/page.tsx", root), "utf8"),
    readFile(new URL("src/app/admin/(protected)/events/project-showcase/page.tsx", root), "utf8"),
    readFile(new URL("src/components/admin/ShowcaseAdminProjectForm.tsx", root), "utf8"),
    readFile(new URL("src/components/admin/ShowcaseEventSettingsForm.tsx", root), "utf8"),
  ]);
  assert.match(draw, /getShowcaseSettlementBlocker\(event, state\)/u);
  assert.match(draw, /isShowcaseSettlementOverdue\(event, state\)/u);
  assert.match(page, /lockedReason=\{settled \? SHOWCASE_SETTLED_LOCK_MESSAGE : null\}/u);
  assert.match(form, /getShowcaseAdminStatusOptions\(project\?\.status\)/u);
  assert.match(form, /<fieldset disabled=\{locked\}/u);
  assert.match(settings, /<fieldset disabled=\{locked\}/u);
});
