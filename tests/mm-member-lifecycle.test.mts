import assert from "node:assert/strict";
import test from "node:test";

const lifecycleModulePromise = import(
  new URL("../src/lib/mm-member-sync/lifecycle.ts", import.meta.url).href,
) as Promise<typeof import("../src/lib/mm-member-sync/lifecycle.ts")>;

test("직접 Mattermost 조회에서 delete_at이 없거나 0이면 lifecycle을 전환하지 않는다", async () => {
  const { resolveMattermostLifecycle, toMattermostLifecycleResult } = await lifecycleModulePromise;

  const result = toMattermostLifecycleResult({
    id: "mm.student-1",
    username: "student_one",
    deleteAt: 0,
  });

  assert.deepEqual(
    resolveMattermostLifecycle({ result, isStaff: false }),
    {
      lifecycleStatus: "active",
      transitionReason: null,
      detailCode: "MM_USER_ACTIVE",
    },
  );
});

test("성공한 직접 조회의 명시적 delete_at만 학생·운영진 lifecycle 전환으로 매핑한다", async () => {
  const { resolveMattermostLifecycle, toMattermostLifecycleResult } = await lifecycleModulePromise;
  const result = toMattermostLifecycleResult({
    id: "mm.user-1",
    username: "user_one",
    deleteAt: 1_720_000_000_000,
  });

  assert.deepEqual(
    resolveMattermostLifecycle({ result, isStaff: false }),
    {
      lifecycleStatus: "graduated",
      transitionReason: "generation_completed",
      detailCode: "MM_USER_DELETE_AT_SET",
    },
  );
  assert.deepEqual(
    resolveMattermostLifecycle({ result, isStaff: true }),
    {
      lifecycleStatus: "departed",
      transitionReason: "member_departed",
      detailCode: "MM_USER_DELETE_AT_SET",
    },
  );
});

test("404·timeout·형식 오류처럼 결과가 없거나 불완전한 경우 lifecycle을 전환하지 않는다", async () => {
  const { resolveMattermostLifecycle } = await lifecycleModulePromise;

  assert.deepEqual(
    resolveMattermostLifecycle({ result: null, isStaff: false }),
    {
      lifecycleStatus: "unresolved",
      transitionReason: null,
      detailCode: "MM_USER_RESULT_MISSING",
    },
  );
  assert.deepEqual(
    resolveMattermostLifecycle({
      result: {
        mmUserId: "mm.user-1",
        username: "user_one",
        deleteAt: Number.NaN,
        lifecycleStatus: "unresolved",
        detailCode: "MM_USER_DELETE_AT_SET",
        effectiveAt: null,
        requestId: null,
      },
      isStaff: false,
    }),
    {
      lifecycleStatus: "unresolved",
      transitionReason: null,
      detailCode: "MM_USER_RESPONSE_INVALID",
    },
  );
});
