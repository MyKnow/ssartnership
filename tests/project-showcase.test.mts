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
    ownerStudentNumber: "1512343",
    teammates: [],
    imageUploadId: IMAGE_ID,
    participantsConsent: true,
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
  test("학번은 숫자 7자리만 허용한다", () => {
    for (const value of ["151234", "15123456", "15-1234", "abcdefg", " "]) {
      const result = validation.parseShowcaseProjectSubmission(submission({ ownerStudentNumber: value }));
      assert.equal(result.success, false, value);
      if (!result.success) assert.equal(result.field, "ownerStudentNumber");
    }
    assert.equal(validation.parseShowcaseProjectSubmission(submission({ ownerStudentNumber: " 1612345 " })).success, true);
  });

  test("팀원이 있으면 팀명이 필요하다", () => {
    const teammates = [{ name: "천창현", studentNumber: "1500001" }];
    const missing = validation.parseShowcaseProjectSubmission(submission({ teammates }));
    assert.equal(missing.success, false);
    if (!missing.success) assert.equal(missing.field, "teamName");
    assert.equal(parsedSubmission({ teammates, teamName: "싸트너십팀" }).teamName, "싸트너십팀");
    assert.equal(parsedSubmission({ teamName: "  " }).teamName, null);
  });

  test("대표자와 팀원 사이에서 학번이 겹치면 거절한다", () => {
    const result = validation.parseShowcaseProjectSubmission(submission({
      teamName: "팀",
      teammates: [{ name: "천창현", studentNumber: "1512343" }],
    }));
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.field, "teammates");
  });

  test("체험 주소는 https만, Embedded는 허용된 영상 호스트만 받는다", () => {
    assert.equal(validation.parseShowcaseProjectSubmission(submission({ serviceUrl: "http://example.com" })).success, false);
    assert.equal(validation.parseShowcaseProjectSubmission(submission({ projectType: "embedded", serviceUrl: "https://example.com/demo" })).success, false);
    assert.equal(parsedSubmission({ projectType: "embedded", serviceUrl: "https://youtu.be/abc" }).projectType, "embedded");
    assert.equal(parsedSubmission({ projectType: "game", serviceUrl: "https://example.com/game" }).projectType, "game");
  });

  test("두 가지 동의는 모두 필수다", () => {
    for (const field of ["participantsConsent", "announcementConsent"]) {
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

test("당첨 공지 마스킹은 정** · 15****43 형식이다", () => {
  assert.equal(types.maskShowcaseName("정민호"), "정**");
  assert.equal(types.maskShowcaseName("  김  "), "김**");
  assert.equal(types.maskShowcaseStudentNumber("1512343"), "15****43");
  assert.equal(types.maskShowcaseStudentNumber("1600001"), "16****01");
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
  assert.equal(errors.showcaseErrorCodeFromDatabase("showcase_owner_already_submitted"), "owner_already_submitted");
  assert.equal(errors.showcaseErrorCodeFromDatabase("ERROR: showcase_student_number_taken"), "student_number_taken");
  assert.equal(errors.showcaseErrorCodeFromDatabase("duplicate key value"), "unknown");
  const failure = errors.toShowcaseFailure(new errors.ShowcaseDomainError("student_number_taken"));
  assert.equal(failure.field, "teammates");
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

  test("참가자 1인당 출품은 1개다", async () => {
    await repository.createProject(write("p1", OWNER));
    const own = await repository.getActiveOwnerProject(OWNER);
    assert.equal(own?.status, "pending");
    assert.deepEqual(own?.participants, [{ name: "정민호", studentNumber: "1512343", isOwner: true }]);
    await expectCode(repository.createProject(write("p2", OWNER, { ownerStudentNumber: "1512344" })), "owner_already_submitted");
  });

  test("같은 학번은 다른 프로젝트 명단에 들어갈 수 없고, 출품을 취소하면 학번과 출품 자격이 풀린다", async () => {
    await repository.createProject(write("p1", OWNER));
    await expectCode(repository.createProject(write("p2", OTHER, {
      ownerStudentNumber: "1500009",
      teamName: "팀",
      teammates: [{ name: "정민호", studentNumber: "1512343" }],
    })), "student_number_taken");

    await repository.withdrawProject({ projectId: "p1", ownerMemberId: OWNER });
    assert.equal(await repository.getActiveOwnerProject(OWNER), null);
    await repository.createProject(write("p2", OTHER, {
      ownerStudentNumber: "1500009",
      teamName: "팀",
      teammates: [{ name: "정민호", studentNumber: "1512343" }],
    }));
    await repository.createProject(write("p3", OWNER, { ownerStudentNumber: "1512399" }));
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
