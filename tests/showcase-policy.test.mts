import assert from "node:assert/strict";
import test from "node:test";
const validation = await import(new URL("../src/lib/project-showcase/validation.ts", import.meta.url).href) as typeof import("../src/lib/project-showcase/validation");

test("showcase submission requires no student number or teammate roster", () => {
  const result = validation.parseShowcaseProjectSubmission({
    projectType: "web", title: "여러 작품", teamName: "", summary: "출품 안내를 확인하는 프로젝트",
    description: "회원이 만든 프로젝트를 소개하고 함께 체험할 수 있는 서비스입니다.",
    serviceUrl: "https://example.com", imageUploadId: "ad6e43a7-962f-4c54-89f3-4d2a13968356", announcementConsent: true,
  });
  assert.equal(result.success, true);
});
test("showcase experience registration only needs announcement consent", () => {
  const result = validation.parseShowcaseRegistration({ announcementConsent: true });
  assert.equal(result.success, true);
});

const draw = await import(new URL("../src/lib/project-showcase/draw.ts", import.meta.url).href) as typeof import("../src/lib/project-showcase/draw");

test("every approved project gives one ticket and winning removes every ticket of its member", () => {
  const projects = [{ memberId: "a", projectId: "a1" }, { memberId: "a", projectId: "a2" }, { memberId: "b", projectId: "b1" }];
  const winners = [0, 1, 2].map((index) => draw.sampleShowcaseProjects(projects, 1, () => index)[0]?.memberId);
  assert.deepEqual(winners, ["a", "a", "b"]);
  const bounds: number[] = [];
  const selected = draw.sampleShowcaseProjects(projects, 20, (max) => { bounds.push(max); return 0; });
  assert.deepEqual(bounds, [3, 1]);
  assert.deepEqual(selected.map((item) => item.memberId), ["a", "b"]);
  assert.equal(projects.length, 3);
});
test("empty and detached owners do not produce phantom prizes", () => {
  assert.deepEqual(draw.sampleShowcaseProjects([], 20), []);
  assert.deepEqual(draw.sampleShowcaseProjects([{ memberId: null }], 20), []);
  assert.deepEqual(draw.sampleShowcaseProjects([{ memberId: "a" }], 0), []);
});
