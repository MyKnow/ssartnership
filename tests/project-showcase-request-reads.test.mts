import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const indexSource = readFileSync(
  new URL("../src/lib/project-showcase/index.ts", import.meta.url),
  "utf8",
);

test("쇼케이스 저장소 경계는 이벤트·공개 프로젝트 조회를 요청 단위로 메모이즈한다", () => {
  assert.match(indexSource, /import \{ cache \} from "react"/);
  assert.match(indexSource, /const getEvent = cache\(\(\) => repository\.getEvent\(\)\)/);
  assert.match(
    indexSource,
    /const getPublicProject = cache\(\(projectId: string\) =>\s*repository\.getPublicProject\(projectId\)/,
  );
  assert.match(
    indexSource,
    /export const projectShowcaseRepository: ProjectShowcaseRepository = withRequestScopedShowcaseReads\(/,
  );
});

test("요청 단위 래퍼는 나머지 메서드를 원본 인스턴스에 바인딩해 전달한다", async () => {
  const { withRequestScopedShowcaseReads } = await import(
    new URL("../src/lib/project-showcase/index.ts", import.meta.url).href
  );

  class FakeRepository {
    eventReads = 0;
    async getEvent() {
      this.eventReads += 1;
      return { id: "event-1" };
    }
    async getPublicProject(projectId: string) {
      return { id: projectId };
    }
    async countEventReads() {
      return this.eventReads;
    }
  }

  const fake = new FakeRepository();
  const wrapped = withRequestScopedShowcaseReads(fake);

  assert.deepEqual(await wrapped.getEvent(), { id: "event-1" });
  assert.deepEqual(await wrapped.getPublicProject("project-1"), { id: "project-1" });
  assert.equal(await wrapped.countEventReads(), 1);
});
