import assert from "node:assert/strict";
import test, { beforeEach, describe } from "node:test";

process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";

type TypesModule = typeof import("../src/lib/project-showcase/types");
type ValidationModule = typeof import("../src/lib/project-showcase/validation");
type ErrorsModule = typeof import("../src/lib/project-showcase/errors");
type MockRepositoryModule = typeof import("../src/lib/project-showcase/repository.mock");

const types = await (import(new URL("../src/lib/project-showcase/types.ts", import.meta.url).href) as Promise<TypesModule>);
const validation = await (import(new URL("../src/lib/project-showcase/validation.ts", import.meta.url).href) as Promise<ValidationModule>);
const errors = await (import(new URL("../src/lib/project-showcase/errors.ts", import.meta.url).href) as Promise<ErrorsModule>);
const mock = await (import(new URL("../src/lib/project-showcase/repository.mock.ts", import.meta.url).href) as Promise<MockRepositoryModule>);

const IMAGE_ID = "ad6e43a7-962f-4c54-89f3-4d2a13968356";
const DAY = 24 * 60 * 60 * 1000;

function submission(overrides: Record<string, unknown> = {}) {
  return {
    projectType: "web",
    title: "싸트너십",
    teamName: "",
    summary: "SSAFY 제휴 혜택을 한곳에서 찾아봐요.",
    description: "역삼역 주변 제휴처와 혜택을 검색하고 구성원 인증까지 제공하는 서비스입니다.",
    serviceUrl: "https://ssartnership.example.com",
    imageUploadId: IMAGE_ID,
    announcementConsent: true,
    ...overrides,
  };
}

function parsedSubmission(overrides: Record<string, unknown> = {}) {
  const result = validation.parseShowcaseProjectSubmission(submission(overrides));
  if (!result.success) throw new Error(result.message);
  return result.data;
}

function eventAt(now: number, isActive = true) {
  return {
    id: "event",
    slug: "project-showcase",
    title: "쇼케이스",
    description: "",
    heroImageSrc: "",
    submissionStartAt: new Date(now + 1 * DAY).toISOString(),
    submissionEndAt: new Date(now + 2 * DAY).toISOString(),
    experienceStartAt: new Date(now + 3 * DAY).toISOString(),
    experienceEndAt: new Date(now + 4 * DAY).toISOString(),
    announcementStartAt: new Date(now + 5 * DAY).toISOString(),
    announcementEndAt: new Date(now + 6 * DAY).toISOString(),
    submitterSelectionCount: 20,
    experiencerSelectionCount: 25,
    isActive,
  };
}

describe("출품 입력 검증", () => {
  test("학번·팀원 없이 출품하고 오래된 폼의 식별 정보는 저장 데이터에서 제외한다", () => {
    const parsed = parsedSubmission({ ownerStudentNumber: "1512343", teammates: [{ name: "팀원" }], participantsConsent: false });
    assert.equal("ownerStudentNumber" in parsed, false);
    assert.equal("teammates" in parsed, false);
    assert.equal("participantsConsent" in parsed, false);
  });
  test("팀명은 선택이며 길이는 검증한다", () => {
    assert.equal(parsedSubmission({ teamName: "  " }).teamName, null);
    assert.equal(parsedSubmission({ teamName: "팀" }).teamName, "팀");
    assert.equal(validation.parseShowcaseProjectSubmission(submission({ teamName: "가".repeat(61) })).success, false);
  });

  test("체험 주소는 https만, Embedded는 허용된 영상 호스트만 받는다", () => {
    assert.equal(validation.parseShowcaseProjectSubmission(submission({ serviceUrl: "http://example.com" })).success, false);
    assert.equal(validation.parseShowcaseProjectSubmission(submission({ projectType: "embedded", serviceUrl: "https://example.com/demo" })).success, false);
    assert.equal(parsedSubmission({ projectType: "embedded", serviceUrl: "https://youtu.be/abc" }).projectType, "embedded");
    assert.equal(parsedSubmission({ projectType: "game", serviceUrl: "https://example.com/game" }).projectType, "game");
  });

  test("이름 공개 동의는 필수다", () => {
    for (const field of ["announcementConsent"]) {
      const result = validation.parseShowcaseProjectSubmission(submission({ [field]: false }));
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.field, field);
    }
  });

  test("새 출품은 대표 이미지가 필요하고 수정은 기존 이미지를 유지할 수 있다", () => {
    const create = validation.parseShowcaseProjectSubmission(submission({ imageUploadId: null }));
    assert.equal(create.success, false);
    if (!create.success) assert.equal(create.field, "imageUploadId");
    assert.equal(validation.parseShowcaseProjectSubmission(submission({ imageUploadId: null }), { requireImage: false }).success, true);
  });
});

describe("이벤트 단계", () => {
  const now = Date.UTC(2026, 9, 1);
  const event = eventAt(now);
  const at = (days: number) => new Date(now + days * DAY);

  test("일정에 따라 단계와 다음 일정이 바뀐다", () => {
    const expected: Array<[number, string, string | null]> = [
      [0.5, "upcoming", "출품 시작"],
      [1.5, "submission", "출품 마감"],
      [2.5, "reviewing", "체험 시작"],
      [3.5, "experience", "체험 마감"],
      [4.5, "verification", "결과 발표"],
      [5.5, "announcement", null],
      [6.5, "closed", null],
    ];
    for (const [days, phase, milestone] of expected) {
      assert.equal(types.getShowcasePhase(event, at(days)), phase, `${days}일`);
      assert.equal(types.getShowcaseNextMilestone(event, phase as never)?.label ?? null, milestone);
    }
  });

  test("일정이 비면 준비 중, 비활성화하면 날짜와 관계없이 중단이다", () => {
    assert.equal(types.getShowcasePhase(null), "setup");
    assert.equal(types.getShowcasePhase({ ...event, experienceEndAt: null }, at(1.5)), "setup");
    assert.equal(types.getShowcasePhase({ ...event, isActive: false }, at(1.5)), "paused");
  });

  test("출품자는 모집 기간의 확인 대기·수정 요청 상태에서만 수정하고, 취소는 모집 기간 내내 가능하다", () => {
    assert.equal(types.canOwnerEditShowcaseProject("pending", "submission"), true);
    assert.equal(types.canOwnerEditShowcaseProject("changes_requested", "submission"), true);
    assert.equal(types.canOwnerEditShowcaseProject("approved", "submission"), false);
    assert.equal(types.canOwnerEditShowcaseProject("pending", "reviewing"), false);
    assert.equal(types.canOwnerWithdrawShowcaseProject("approved", "submission"), true);
    assert.equal(types.canOwnerWithdrawShowcaseProject("approved", "experience"), false);
    assert.equal(types.canOwnerWithdrawShowcaseProject("withdrawn", "submission"), false);
  });
});

test("당첨 공지에는 이름 일부만 남긴다", () => {
  assert.equal(types.maskShowcaseName("정민호"), "정**");
  assert.equal(types.maskShowcaseName("  김  "), "김**");
});

describe("관리자 일정·검수 검증", () => {
  const valid = {
    submissionStartAt: "2026-10-01T10:00",
    submissionEndAt: "2026-10-08T10:00",
    experienceStartAt: "2026-10-08T10:00",
    experienceEndAt: "2026-10-15T10:00",
    announcementStartAt: "2026-10-17T10:00",
    announcementEndAt: "",
    submitterSelectionCount: "20",
    experiencerSelectionCount: "25",
    isActive: "true",
  };

  test("한국 시간 입력을 UTC로 바꾸고 발표 종료는 비워 둘 수 있다", () => {
    const result = validation.parseShowcaseSchedule(valid);
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.data.submissionStartAt, "2026-10-01T01:00:00.000Z");
    assert.equal(result.data.announcementEndAt, null);
    assert.equal(result.data.isActive, true);
  });

  test("기간이 겹치거나 수량이 범위를 벗어나면 해당 필드를 가리킨다", () => {
    const overlap = validation.parseShowcaseSchedule({ ...valid, experienceStartAt: "2026-10-07T10:00" });
    assert.equal(overlap.success, false);
    if (!overlap.success) assert.equal(overlap.field, "experienceStartAt");
    const count = validation.parseShowcaseSchedule({ ...valid, experiencerSelectionCount: "501" });
    assert.equal(count.success, false);
    if (!count.success) assert.equal(count.field, "experiencerSelectionCount");
    const missing = validation.parseShowcaseSchedule({ ...valid, submissionEndAt: "" });
    assert.equal(missing.success, false);
  });

  test("수정 요청과 반려는 출품자에게 보여 줄 사유가 필요하다", () => {
    assert.equal(validation.parseShowcaseReview({ status: "approved", reviewNote: "" }).success, true);
    for (const status of ["changes_requested", "rejected"]) {
      const result = validation.parseShowcaseReview({ status, reviewNote: "  " });
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.field, "reviewNote");
    }
    assert.equal(validation.parseShowcaseReview({ status: "withdrawn", reviewNote: "x" }).success, false);
  });
});

test("DB 예외 문구를 공용 에러 코드와 메시지로 바꾼다", () => {
  assert.equal(errors.showcaseErrorCodeFromDatabase("showcase_project_not_editable"), "project_not_editable");
  assert.equal(errors.showcaseErrorCodeFromDatabase("ERROR: showcase_registration_exists"), "registration_exists");
  assert.equal(errors.showcaseErrorCodeFromDatabase("duplicate key value"), "unknown");
  const failure = errors.toShowcaseFailure(new errors.ShowcaseDomainError("feedback_invalid"));
  assert.equal(failure.field, "body");
  assert.equal(errors.toShowcaseFailure(new Error("secret db detail")).message.includes("secret"), false);
});

describe("mock Repository 출품 규칙", () => {
  const repository = new mock.MockProjectShowcaseRepository();
  const OWNER = "member-owner";
  const OTHER = "member-other";

  function write(projectId: string, ownerMemberId: string, overrides: Record<string, unknown> = {}) {
    return {
      eventId: "mock-project-showcase-event",
      projectId,
      ownerMemberId,
      ownerName: ownerMemberId === OWNER ? "정민호" : "천창현",
      submission: parsedSubmission(overrides),
      imageUrl: "/ads/project-showcase-banner.png",
    };
  }

  async function expectCode(promise: Promise<unknown>, code: string) {
    await assert.rejects(promise, (error: unknown) => error instanceof errors.ShowcaseDomainError && error.code === code);
  }

  beforeEach(() => {
    mock.resetProjectShowcaseMockStore({ memberNames: { [OWNER]: "정민호", [OTHER]: "천창현" } });
  });

  test("한 회원이 여러 출품을 등록하고 각각 조회한다", async () => {
    await repository.createProject(write("p1", OWNER));
    await repository.createProject(write("p2", OWNER));
    const own = await repository.listOwnerProjects(OWNER);
    assert.equal(own.length, 2);
    assert.ok(own.every((project) => project.status === "pending"));
    assert.ok(own.every((project) => !("participants" in project)));
    assert.equal((await repository.listOwnerProjects(OTHER)).length, 0);
  });
  test("중복 프로젝트는 운영자가 반려하고, 한 출품 취소는 다른 출품에 영향을 주지 않는다", async () => {
    await repository.createProject(write("p1", OWNER));
    await repository.createProject(write("p2", OTHER));
    await repository.reviewProject({ projectId: "p2", adminId: "admin", status: "rejected", reviewNote: validation.SHOWCASE_DUPLICATE_PROJECT_REASON });
    assert.equal((await repository.getOwnerProject(OTHER, "p2"))?.reviewNote, "이미 등록된 프로젝트입니다");
    await repository.createProject(write("p3", OWNER));
    await repository.withdrawProject({ projectId: "p1", ownerMemberId: OWNER });
    assert.equal((await repository.getOwnerProject(OWNER, "p1"))?.status, "withdrawn");
    assert.equal((await repository.getOwnerProject(OWNER, "p3"))?.status, "pending");
    await repository.createProject(write("p4", OWNER));
    assert.equal((await repository.listOwnerProjects(OWNER)).length, 3);
  });

  test("확인 대기·수정 요청 상태만 수정할 수 있고 수정하면 다시 확인 대기로 돌아간다", async () => {
    await repository.createProject(write("p1", OWNER));
    await repository.reviewProject({ projectId: "p1", adminId: "admin", status: "changes_requested", reviewNote: "링크가 열리지 않아요" });
    const requested = await repository.getOwnerProject(OWNER, "p1");
    assert.equal(requested?.reviewNote, "링크가 열리지 않아요");

    await repository.updateProject({ ...write("p1", OWNER, { title: "싸트너십 v2" }), imageUrl: null });
    const updated = await repository.getOwnerProject(OWNER, "p1");
    assert.equal(updated?.status, "pending");
    assert.equal(updated?.title, "싸트너십 v2");
    assert.equal(updated?.imageUrl, "/ads/project-showcase-banner.png");

    await repository.reviewProject({ projectId: "p1", adminId: "admin", status: "approved", reviewNote: "" });
    await expectCode(repository.updateProject({ ...write("p1", OWNER), imageUrl: null }), "project_not_editable");
    await expectCode(repository.updateProject({ ...write("p1", OTHER), imageUrl: null }), "project_not_found");
  });

  test("모집 기간이 아니면 출품·수정·취소를 막는다", async () => {
    await repository.createProject(write("p1", OWNER));
    const closed = eventAt(Date.now());
    await repository.updateEventSchedule({
      submissionStartAt: closed.submissionStartAt,
      submissionEndAt: closed.submissionEndAt,
      experienceStartAt: closed.experienceStartAt,
      experienceEndAt: closed.experienceEndAt,
      announcementStartAt: closed.announcementStartAt,
      announcementEndAt: closed.announcementEndAt,
      submitterSelectionCount: 20,
      experiencerSelectionCount: 25,
      isActive: true,
    });
    await expectCode(repository.createProject(write("p2", OTHER, { ownerStudentNumber: "1500009" })), "submission_closed");
    await expectCode(repository.updateProject({ ...write("p1", OWNER), imageUrl: null }), "submission_closed");
    await expectCode(repository.withdrawProject({ projectId: "p1", ownerMemberId: OWNER }), "submission_closed");
  });

  test("공개 목록과 상세는 체험 기간의 승인 프로젝트만 보여 주고, 조회는 본인 제외·회원별 1회만 센다", async () => {
    assert.deepEqual(await repository.listPublicProjects(), []);
    assert.equal(await repository.getPublicProject("mock-showcase-green-route"), null);

    const now = Date.now();
    mock.resetProjectShowcaseMockStore({
      event: {
        submissionStartAt: new Date(now - 3 * DAY).toISOString(),
        submissionEndAt: new Date(now - 2 * DAY).toISOString(),
        experienceStartAt: new Date(now - DAY).toISOString(),
        experienceEndAt: new Date(now + DAY).toISOString(),
        announcementStartAt: new Date(now + 2 * DAY).toISOString(),
      },
    });
    const projects = await repository.listPublicProjects({ type: "game" });
    assert.deepEqual(projects.map((project) => project.id), ["mock-showcase-pixel-quest"]);

    await repository.recordUniqueView("mock-showcase-green-route", OWNER);
    await repository.recordUniqueView("mock-showcase-green-route", OWNER);
    await repository.recordUniqueView("mock-showcase-green-route", "mock-member-green-route");
    assert.equal((await repository.getPublicProject("mock-showcase-green-route"))?.viewCount, 1);
  });
});

test("mock 쇼케이스 이벤트는 실행 시각과 관계없이 모집 기간으로 시작한다", async () => {
  const repository = new mock.MockProjectShowcaseRepository();
  for (const now of [Date.UTC(2026, 8, 26, 14, 59), Date.UTC(2026, 11, 31, 15, 0), Date.UTC(2031, 0, 1)]) {
    mock.resetProjectShowcaseMockStore({ now });
    const event = await repository.getEvent();
    assert.equal(types.getShowcasePhase(event, new Date(now)), "submission");
    assert.equal(types.getShowcasePhase(event, new Date(now + 5 * DAY)), "submission");
  }
  mock.resetProjectShowcaseMockStore();
});

describe("체험·피드백 규칙", () => {
  test("피드백은 체험 시작 60초 뒤부터 열리고, 추첨권은 유효 체험 수만큼이다", () => {
    const startedAt = "2026-10-05T01:00:00.000Z";
    assert.equal(types.canSubmitShowcaseFeedback(null), false);
    assert.equal(types.canSubmitShowcaseFeedback(startedAt, new Date("2026-10-05T01:00:59.999Z")), false);
    assert.equal(types.canSubmitShowcaseFeedback(startedAt, new Date("2026-10-05T01:01:00.000Z")), true);
    assert.equal(types.countShowcaseTickets([]), 0);
    assert.equal(types.countShowcaseTickets([{ feedbackSubmitted: true }, { feedbackSubmitted: false }, { feedbackSubmitted: true }]), 2);
  });

  test("참여 등록은 당첨 발표 동의만 필요하다", () => {
    assert.equal(validation.parseShowcaseRegistration({ announcementConsent: true }).success, true);
    const missing = validation.parseShowcaseRegistration({ announcementConsent: false });
    assert.equal(missing.success, false);
    if (!missing.success) assert.equal(missing.field, "announcementConsent");
    const legacy = validation.parseShowcaseRegistration({ announcementConsent: true });
    if (legacy.success) assert.deepEqual(legacy.data, { announcementConsent: true });
  });

  test("피드백 길이는 DB char_length와 같게 코드 포인트로 센다", () => {
    assert.equal(validation.parseShowcaseFeedback("  아홉 글자 입니다  ").success, false);
    assert.equal(validation.parseShowcaseFeedback("열 글자를 딱 채웠어요").success, true);
    assert.equal(validation.parseShowcaseFeedback("😀".repeat(300)).success, true);
    assert.equal(validation.parseShowcaseFeedback("😀".repeat(301)).success, false);
  });
});

describe("mock Repository 체험 규칙", () => {
  const repository = new mock.MockProjectShowcaseRepository();
  const MEMBER = "member-experiencer";
  const OTHER = "member-other-experiencer";
  const PROJECT = "mock-showcase-green-route";
  const PROJECT_OWNER = "mock-member-green-route";
  let store: ReturnType<typeof mock.resetProjectShowcaseMockStore>;

  async function expectCode(promise: Promise<unknown>, code: string) {
    await assert.rejects(promise, (error: unknown) => error instanceof errors.ShowcaseDomainError && error.code === code);
  }

  function rewindStart(projectId: string, memberId: string, seconds: number) {
    const experience = store.experiences.find((item) => item.projectId === projectId && item.memberId === memberId);
    assert.ok(experience);
    experience.startedAt = new Date(Date.now() - seconds * 1000).toISOString();
  }

  beforeEach(() => {
    const now = Date.now();
    store = mock.resetProjectShowcaseMockStore({
      event: {
        submissionStartAt: new Date(now - 10 * DAY).toISOString(),
        submissionEndAt: new Date(now - 3 * DAY).toISOString(),
        experienceStartAt: new Date(now - DAY).toISOString(),
        experienceEndAt: new Date(now + 6 * DAY).toISOString(),
        announcementStartAt: new Date(now + 8 * DAY).toISOString(),
      },
    });
  });

  test("참여 등록은 회원당 1번이며 다른 회원의 등록을 막지 않는다", async () => {
    await repository.registerParticipant({ memberId: MEMBER });
    await expectCode(repository.registerParticipant({ memberId: MEMBER }), "registration_exists");
    await repository.registerParticipant({ memberId: OTHER });
    const participation = await repository.getMemberParticipation(MEMBER);
    assert.ok(participation.registration?.registeredAt);
    assert.equal("maskedStudentNumber" in participation.registration, false);
    assert.equal(participation.ticketCount, 0);
  });

  test("체험 시작은 등록 회원만, 본인 프로젝트는 불가하고 첫 시작 시각을 유지한다", async () => {
    await expectCode(repository.startExperience({ projectId: PROJECT, memberId: MEMBER }), "registration_required");
    await repository.registerParticipant({ memberId: MEMBER });
    const first = await repository.startExperience({ projectId: PROJECT, memberId: MEMBER });
    const second = await repository.startExperience({ projectId: PROJECT, memberId: MEMBER });
    assert.equal(second.startedAt, first.startedAt);
    await repository.registerParticipant({ memberId: PROJECT_OWNER });
    await expectCode(repository.startExperience({ projectId: PROJECT, memberId: PROJECT_OWNER }), "own_project");
    await expectCode(repository.startExperience({ projectId: "mock-showcase-study-buddy", memberId: MEMBER }), "project_not_found");
  });

  test("피드백은 1분 뒤 1번만 남길 수 있고 추첨권이 1장씩 늘어난다", async () => {
    await repository.registerParticipant({ memberId: MEMBER });
    await expectCode(repository.submitFeedback({ projectId: PROJECT, memberId: MEMBER, body: "길찾기가 편했어요 최고" }), "experience_not_started");
    await repository.startExperience({ projectId: PROJECT, memberId: MEMBER });
    await expectCode(repository.submitFeedback({ projectId: PROJECT, memberId: MEMBER, body: "길찾기가 편했어요 최고" }), "feedback_too_early");
    rewindStart(PROJECT, MEMBER, 61);
    await repository.submitFeedback({ projectId: PROJECT, memberId: MEMBER, body: "길찾기가 편했어요 최고" });
    await expectCode(repository.submitFeedback({ projectId: PROJECT, memberId: MEMBER, body: "한 번 더 남기고 싶어요" }), "feedback_exists");

    await repository.startExperience({ projectId: "mock-showcase-pixel-quest", memberId: MEMBER });
    rewindStart("mock-showcase-pixel-quest", MEMBER, 120);
    await repository.submitFeedback({ projectId: "mock-showcase-pixel-quest", memberId: MEMBER, body: "퍼즐이 짧고 재밌어요!" });

    const participation = await repository.getMemberParticipation(MEMBER);
    assert.equal(participation.ticketCount, 2);
    assert.deepEqual((await repository.listMemberCompletedProjectIds(MEMBER)).sort(), ["mock-showcase-green-route", "mock-showcase-pixel-quest"]);
    const project = await repository.getPublicProject(PROJECT);
    assert.equal(project?.experienceCount, 1);
    assert.equal(project?.validExperienceCount, 1);
  });

  test("출품자에게는 숨기지 않은 피드백 본문만 작성자 없이 전달되고, 숨겨도 유효 체험은 유지된다", async () => {
    await repository.registerParticipant({ memberId: MEMBER });
    await repository.startExperience({ projectId: PROJECT, memberId: MEMBER });
    rewindStart(PROJECT, MEMBER, 90);
    await repository.submitFeedback({ projectId: PROJECT, memberId: MEMBER, body: "쉼터 추천이 정말 유용했어요" });

    const visible = await repository.listOwnerFeedback(PROJECT_OWNER, PROJECT);
    assert.deepEqual(visible.map((item) => Object.keys(item).sort()), [["body", "id"]]);
    assert.deepEqual(await repository.listOwnerFeedback(MEMBER, PROJECT), []);

    const [adminItem] = await repository.listAdminFeedback({ hidden: false });
    assert.ok(adminItem);
    await repository.setFeedbackHidden({ feedbackId: adminItem.id, adminId: "admin", hidden: true });
    assert.deepEqual(await repository.listOwnerFeedback(PROJECT_OWNER, PROJECT), []);
    assert.equal((await repository.getPublicProject(PROJECT))?.validExperienceCount, 1);
    assert.equal((await repository.getMemberParticipation(MEMBER)).ticketCount, 1);
  });

  test("관심 표시는 토글되고 본인 프로젝트·체험 기간 밖에서는 거절한다", async () => {
    await repository.setInterest({ projectId: PROJECT, memberId: MEMBER, interested: true });
    await repository.setInterest({ projectId: PROJECT, memberId: MEMBER, interested: true });
    assert.equal((await repository.getPublicProject(PROJECT))?.interestCount, 1);
    assert.equal((await repository.getMemberProjectState(PROJECT, MEMBER)).interested, true);
    await repository.setInterest({ projectId: PROJECT, memberId: MEMBER, interested: false });
    assert.equal((await repository.getPublicProject(PROJECT))?.interestCount, 0);
    await expectCode(repository.setInterest({ projectId: PROJECT, memberId: PROJECT_OWNER, interested: true }), "own_project");

    mock.resetProjectShowcaseMockStore();
    await expectCode(repository.setInterest({ projectId: PROJECT, memberId: MEMBER, interested: true }), "experience_closed");
    await expectCode(repository.registerParticipant({ memberId: MEMBER }), "experience_closed");
  });

  test("체험 단계 DB 예외도 공용 에러 코드로 바뀐다", () => {
    for (const code of ["feedback_too_early", "registration_required", "own_project", "experience_closed"]) {
      assert.equal(errors.showcaseErrorCodeFromDatabase(`ERROR: showcase_${code}`), code);
    }
  });
});

type DrawModule = typeof import("../src/lib/project-showcase/draw");
const draw = await (import(new URL("../src/lib/project-showcase/draw.ts", import.meta.url).href) as Promise<DrawModule>);

/** Deterministic stand-in for the CSPRNG: returns queued values modulo the range. */
function queuedRandom(values: number[]) {
  let index = 0;
  return (maxExclusive: number) => (values[index++ % values.length] ?? 0) % maxExclusive;
}

describe("추첨 알고리즘", () => {
  test("균등 추첨은 중복 없이 요청 수만큼, 후보보다 많이 요청하면 전원을 뽑는다", () => {
    const picked = draw.sampleShowcaseUniform(["a", "b", "c", "d"], 2, queuedRandom([3, 0]));
    assert.deepEqual(picked, ["d", "b"]);
    assert.equal(new Set(draw.sampleShowcaseUniform(["a", "b", "c"], 10)).size, 3);
    assert.deepEqual(draw.sampleShowcaseUniform([], 3), []);
  });

  test("가중 추첨은 추첨권 구간으로 고르고, 뽑힌 사람은 다시 뽑히지 않는다", () => {
    const people = [{ id: "a", weight: 1 }, { id: "b", weight: 3 }, { id: "zero", weight: 0 }];
    assert.equal(draw.sampleShowcaseWeighted(people, 1, queuedRandom([0]))[0]?.id, "a");
    for (const ticket of [1, 2, 3]) assert.equal(draw.sampleShowcaseWeighted(people, 1, queuedRandom([ticket]))[0]?.id, "b");
    const both = draw.sampleShowcaseWeighted(people, 5, queuedRandom([1, 0]));
    assert.deepEqual(both.map((person) => person.id), ["b", "a"]);
  });

  test("Mattermost 공지는 분야별 마스킹 명단과 미당첨 분야를 담는다", () => {
    const text = draw.buildShowcaseAnnouncement("내 프로젝트를 소개합니다!", [
      { candidateGroup: "experiencer", position: 1, maskedName: "천**", projectTitle: null },
      { candidateGroup: "submitter", position: 1, maskedName: "정**", projectTitle: "싸트너십" },
    ]);
    assert.match(text, /^\[내 프로젝트를 소개합니다!\] 당첨자 안내/u);
    assert.match(text, /■ 출품 경품 · 배달의민족 상품권 1만 원 \(1명\)\n1\. 싸트너십 · 정\*\*/u);
    assert.match(text, /■ 체험 경품 · 메가커피 아이스 아메리카노 교환권 \(1명\)\n1\. 천\*\*/u);
    assert.doesNotMatch(text, /1512343|1512344|정민호/u);
    assert.match(draw.buildShowcaseAnnouncement("E", []), /당첨자 없음/u);
  });
});

describe("mock Repository 추첨·정산 규칙", () => {
  const repository = new mock.MockProjectShowcaseRepository();
  const OWNER = "mock-member-green-route";
  const TESTER = "member-tester";
  const TESTER2 = "member-tester-2";
  let store: ReturnType<typeof mock.resetProjectShowcaseMockStore>;

  async function expectCode(promise: Promise<unknown>, code: string) {
    await assert.rejects(promise, (error: unknown) => error instanceof errors.ShowcaseDomainError && error.code === code);
  }

  async function giveFeedback(memberId: string, projectId: string) {
    await repository.startExperience({ projectId, memberId });
    const experience = store.experiences.find((item) => item.projectId === projectId && item.memberId === memberId);
    assert.ok(experience);
    experience.startedAt = new Date(Date.now() - 120_000).toISOString();
    await repository.submitFeedback({ projectId, memberId, body: "직접 써 보니 정말 편리했어요" });
  }

  async function moveTo(phase: "verification" | "announcement") {
    const now = Date.now();
    await repository.updateEventSchedule({
      submissionStartAt: new Date(now - 20 * DAY).toISOString(),
      submissionEndAt: new Date(now - 15 * DAY).toISOString(),
      experienceStartAt: new Date(now - 14 * DAY).toISOString(),
      experienceEndAt: new Date(now - 2 * DAY).toISOString(),
      announcementStartAt: new Date(now + (phase === "verification" ? DAY : -DAY)).toISOString(),
      announcementEndAt: new Date(now + 10 * DAY).toISOString(),
      submitterSelectionCount: 20,
      experiencerSelectionCount: 25,
      isActive: true,
    });
  }

  beforeEach(async () => {
    const now = Date.now();
    store = mock.resetProjectShowcaseMockStore({
      memberNames: { [TESTER]: "천창현", [TESTER2]: "김싸피" },
      event: {
        submissionStartAt: new Date(now - 10 * DAY).toISOString(),
        submissionEndAt: new Date(now - 3 * DAY).toISOString(),
        experienceStartAt: new Date(now - DAY).toISOString(),
        experienceEndAt: new Date(now + 6 * DAY).toISOString(),
        announcementStartAt: new Date(now + 8 * DAY).toISOString(),
      },
    });
    // The Green Route owner also experiences another project, so they are in both pools.
    await repository.registerParticipant({ memberId: OWNER });
    await repository.registerParticipant({ memberId: TESTER });
    await repository.registerParticipant({ memberId: TESTER2 });
    await giveFeedback(OWNER, "mock-showcase-pixel-quest");
    await giveFeedback(TESTER, "mock-showcase-pixel-quest");
    await giveFeedback(TESTER, "mock-showcase-green-route");
    await giveFeedback(TESTER2, "mock-showcase-green-route");
  });

  test("복수 승인 출품은 표본을 늘리지만 경품은 회원별 하나만 준다", async () => {
    const original = store.projects.find((project) => project.ownerMemberId === OWNER);
    assert.ok(original);
    store.projects.push({ ...original, id: "second-approved", title: "두 번째 출품" });
    store.projects.push({ ...original, id: "pending-project", status: "pending" });
    store.projects.push({ ...original, id: "rejected-project", status: "rejected" });
    store.projects.push({ ...original, id: "withdrawn-project", status: "withdrawn" });
    await moveTo("verification");
    const bounds: number[] = [];
    const receipt = await repository.runDraw({ group: "submitter", adminId: "admin", random: (max) => { bounds.push(max); return 0; } });
    assert.deepEqual({ people: receipt.candidateCount, tickets: receipt.ticketCount, winners: receipt.selectedCount }, { people: 2, tickets: 3, winners: 2 });
    assert.deepEqual(bounds, [3, 1]);
    assert.equal(store.winners.filter((winner) => winner.memberId === OWNER).length, 1);
    await repository.runDraw({ group: "experiencer", adminId: "admin" });
    assert.equal(store.winners.filter((winner) => winner.memberId === OWNER).length, 1);
    await moveTo("announcement");
    for (const winner of await repository.listPublicWinners()) {
      assert.deepEqual(Object.keys(winner).sort(), ["candidateGroup", "maskedName", "position", "projectTitle"]);
    }
  });

  test("체험이 끝나기 전에는 추첨과 검증을 막는다", async () => {
    await expectCode(repository.runDraw({ group: "submitter", adminId: "admin" }), "draw_closed");
    await expectCode(repository.excludeCandidate({ group: "experiencer", memberId: TESTER, reason: "중복 계정", adminId: "admin" }), "draw_closed");
  });

  test("출품 추첨이 먼저이고, 출품 당첨 대표자는 체험 추첨에서 빠진다", async () => {
    await moveTo("verification");
    await expectCode(repository.runDraw({ group: "experiencer", adminId: "admin" }), "draw_order_invalid");
    const submitter = await repository.runDraw({ group: "submitter", adminId: "admin" });
    assert.equal(submitter.selectedCount, 2);
    await expectCode(repository.runDraw({ group: "submitter", adminId: "admin" }), "draw_exists");

    const experiencers = await repository.listExperiencerCandidates();
    assert.equal(experiencers.find((candidate) => candidate.memberId === OWNER)?.alreadyWon, true);
    assert.equal(experiencers.find((candidate) => candidate.memberId === TESTER)?.tickets, 2);
    const receipt = await repository.runDraw({ group: "experiencer", adminId: "admin" });
    assert.deepEqual({ candidates: receipt.candidateCount, tickets: receipt.ticketCount, selected: receipt.selectedCount }, { candidates: 2, tickets: 3, selected: 2 });

    const winners = await repository.listAdminWinners();
    assert.equal(winners.filter((winner) => winner.candidateGroup === "experiencer").length, 2);
    const activeMembers = store.winners.filter((winner) => winner.status === "active").map((winner) => winner.memberId);
    assert.equal(new Set(activeMembers).size, activeMembers.length);
    assert.ok(winners.every((winner) => !("maskedStudentNumber" in winner) && winner.maskedName.endsWith("**")));
  });

  test("제외한 후보는 추첨되지 않고, 복구하면 다시 후보가 된다", async () => {
    await moveTo("verification");
    await expectCode(repository.excludeCandidate({ group: "experiencer", memberId: TESTER, reason: " ", adminId: "admin" }), "exclusion_invalid");
    await repository.excludeCandidate({ group: "experiencer", memberId: TESTER, reason: "중복 계정 의심", adminId: "admin" });
    await expectCode(repository.excludeCandidate({ group: "experiencer", memberId: TESTER, reason: "중복 계정 의심", adminId: "admin" }), "exclusion_exists");
    await repository.runDraw({ group: "submitter", adminId: "admin" });
    await repository.runDraw({ group: "experiencer", adminId: "admin" });
    assert.equal(store.winners.some((winner) => winner.memberId === TESTER), false);
    const exclusion = (await repository.listExperiencerCandidates()).find((candidate) => candidate.memberId === TESTER)?.exclusion;
    assert.ok(exclusion);
    await repository.restoreCandidate({ exclusionId: exclusion.id, adminId: "admin" });
    assert.equal((await repository.listExperiencerCandidates()).find((candidate) => candidate.memberId === TESTER)?.exclusion, null);
  });

  test("무효 처리한 당첨은 같은 분야에서 1명만 재추첨하고, 후보가 없으면 미집행으로 남긴다", async () => {
    await moveTo("verification");
    await repository.runDraw({ group: "submitter", adminId: "admin" });
    await repository.runDraw({ group: "experiencer", adminId: "admin" });
    const experiencerWinner = (await repository.listAdminWinners()).find((winner) => winner.candidateGroup === "experiencer");
    assert.ok(experiencerWinner);
    await expectCode(repository.redrawWinner({ winnerId: experiencerWinner.id, adminId: "admin" }), "redraw_invalid");
    await repository.voidWinner({ winnerId: experiencerWinner.id, adminId: "admin", reason: "unreachable" });
    const redraw = await repository.redrawWinner({ winnerId: experiencerWinner.id, adminId: "admin" });
    assert.equal(redraw.selectedCount, 0);
    await expectCode(repository.redrawWinner({ winnerId: experiencerWinner.id, adminId: "admin" }), "redraw_invalid");
    const after = await repository.listAdminWinners();
    assert.equal(after.find((winner) => winner.id === experiencerWinner.id)?.replaced, true);
  });

  test("당첨 명단과 내 당첨은 발표 시작부터 보이고, 정산 뒤에는 더 바꿀 수 없다", async () => {
    await moveTo("verification");
    await repository.runDraw({ group: "submitter", adminId: "admin" });
    assert.deepEqual(await repository.listPublicWinners(), []);
    assert.deepEqual(await repository.getMemberWinnings(OWNER), []);
    await expectCode(repository.settleEvent("admin"), "settlement_invalid");

    await moveTo("announcement");
    const publicWinners = await repository.listPublicWinners();
    assert.equal(publicWinners.length, 2);
    assert.ok(publicWinners.every((winner) => !("memberId" in winner)));
    assert.equal((await repository.getMemberWinnings(OWNER))[0]?.projectTitle, "Green Route");

    const winner = (await repository.listAdminWinners())[0];
    assert.ok(winner);
    await repository.setWinnerDelivered({ winnerId: winner.id, adminId: "admin", delivered: true });
    await repository.settleEvent("admin");
    await expectCode(repository.settleEvent("admin"), "settlement_invalid");
    await expectCode(repository.voidWinner({ winnerId: winner.id, adminId: "admin", reason: "duplicate" }), "draw_closed");
    await expectCode(repository.runDraw({ group: "experiencer", adminId: "admin" }), "draw_closed");
  });

  test("개인정보는 정산 30일 뒤에만 파기되고, 마스킹 당첨 명단은 남는다", async () => {
    await moveTo("verification");
    await repository.runDraw({ group: "submitter", adminId: "admin" });
    await moveTo("announcement");
    await repository.settleEvent("admin");
    assert.equal(await repository.purgePersonalDataIfDue(), false);

    store.settledAt = new Date(Date.now() - 31 * DAY).toISOString();
    assert.equal(await repository.purgePersonalDataIfDue(), true);
    assert.equal(await repository.purgePersonalDataIfDue(), false);
    assert.equal(store.registrations.size, 0);
    assert.ok(store.projects.every((project) => project.ownerMemberId === ""));
    assert.ok(store.feedback.every((item) => item.memberId === ""));
    assert.equal((await repository.listPublicWinners()).length, 2);
    assert.equal((await repository.getDrawState()).purgedAt !== null, true);
  });
});

test("쇼케이스 migration은 schema.sql 스냅샷에 원문 그대로 들어 있다", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const root = new URL("../", import.meta.url);
  const schema = readFileSync(new URL("supabase/schema.sql", root), "utf8");
  const migrations = readdirSync(new URL("supabase/migrations/", root)).filter((name) => /showcase/u.test(name)).sort();
  assert.ok(migrations.length >= 4);
  for (const name of migrations) {
    const header = `-- Snapshot of ${name}\n`;
    const start = schema.indexOf(header);
    assert.notEqual(start, -1, `${name} snapshot header`);
    const next = schema.indexOf("\n-- Snapshot of ", start + header.length);
    const body = schema.slice(start + header.length, next === -1 ? undefined : next).trim();
    assert.equal(body, readFileSync(new URL(`supabase/migrations/${name}`, root), "utf8").trim(), `${name} snapshot body`);
  }
});
