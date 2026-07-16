import assert from "node:assert/strict";
import test from "node:test";

const lifecycleModulePromise = import(
  new URL("../src/lib/mm-member-sync/lifecycle.ts", import.meta.url).href,
) as Promise<typeof import("../src/lib/mm-member-sync/lifecycle.ts")>;

test("lifecycle 배치 응답을 회원별 결과로 안전하게 파싱한다", async () => {
  const { parseMattermostLifecycleBatch } = await lifecycleModulePromise;

  const parsed = parseMattermostLifecycleBatch(
    {
      ok: true,
      data: {
        requested_count: 2,
        results: [
          {
            mm_user_id: "mm.student-1",
            username: "student_one",
            member_type: "student",
            lifecycle_status: "graduated",
            detail_code: "USER_INACTIVE",
            effective_at: "2026-07-15T00:00:00.000Z",
          },
          {
            mm_user_id: "mm.staff-1",
            username: null,
            member_type: null,
            lifecycle_status: "unresolved",
            detail_code: "MATTERMOST_ID_NOT_MAPPED",
            effective_at: "2026-07-15T00:00:00.000Z",
          },
        ],
      },
      request_id: "req_lifecycle_1",
    },
    ["mm.student-1", "mm.staff-1"],
  );

  assert.equal(parsed.requestId, "req_lifecycle_1");
  assert.equal(parsed.results.get("mm.student-1")?.lifecycleStatus, "graduated");
  assert.equal(parsed.results.get("mm.staff-1")?.detailCode, "MATTERMOST_ID_NOT_MAPPED");
});

test("student와 staff의 비매핑 ID는 로컬 역할 기준으로 lifecycle을 결정한다", async () => {
  const { resolveMattermostLifecycle } = await lifecycleModulePromise;

  assert.deepEqual(
    resolveMattermostLifecycle({
      result: {
        mmUserId: "mm.student-1",
        username: null,
        memberType: null,
        lifecycleStatus: "unresolved",
        detailCode: "MATTERMOST_ID_NOT_MAPPED",
        effectiveAt: null,
        requestId: "req_1",
      },
      isStaff: false,
    }),
    {
      lifecycleStatus: "graduated",
      transitionReason: "generation_completed",
      detailCode: "MATTERMOST_ID_NOT_MAPPED",
    },
  );

  assert.deepEqual(
    resolveMattermostLifecycle({
      result: {
        mmUserId: "mm.staff-1",
        username: null,
        memberType: null,
        lifecycleStatus: "unresolved",
        detailCode: "MATTERMOST_ID_NOT_MAPPED",
        effectiveAt: null,
        requestId: "req_2",
      },
      isStaff: true,
    }),
    {
      lifecycleStatus: "departed",
      transitionReason: "member_departed",
      detailCode: "MATTERMOST_ID_NOT_MAPPED",
    },
  );
});

test("USER_INACTIVE는 provider가 판정한 역할을 로컬 상태 전환으로 매핑한다", async () => {
  const { resolveMattermostLifecycle } = await lifecycleModulePromise;

  assert.equal(
    resolveMattermostLifecycle({
      result: {
        mmUserId: "mm.student-1",
        username: "student_one",
        memberType: "student",
        lifecycleStatus: "graduated",
        detailCode: "USER_INACTIVE",
        effectiveAt: null,
        requestId: "req_3",
      },
      isStaff: false,
    }).transitionReason,
    "generation_completed",
  );
  assert.equal(
    resolveMattermostLifecycle({
      result: {
        mmUserId: "mm.staff-1",
        username: "staff_one",
        memberType: "staff",
        lifecycleStatus: "departed",
        detailCode: "USER_INACTIVE",
        effectiveAt: null,
        requestId: "req_4",
      },
      isStaff: true,
    }).transitionReason,
    "member_departed",
  );
});

test("unresolved, 역할 불일치, active는 상태 전환하지 않는다", async () => {
  const { resolveMattermostLifecycle } = await lifecycleModulePromise;

  const unresolved = resolveMattermostLifecycle({
    result: {
      mmUserId: "mm.student-1",
      username: null,
      memberType: null,
      lifecycleStatus: "unresolved",
      detailCode: "PROFILE_RECORD_NOT_FOUND",
      effectiveAt: null,
      requestId: "req_5",
    },
    isStaff: false,
  });
  assert.equal(unresolved.transitionReason, null);
  assert.equal(unresolved.lifecycleStatus, "unresolved");

  const mismatch = resolveMattermostLifecycle({
    result: {
      mmUserId: "mm.student-1",
      username: "student_one",
      memberType: "staff",
      lifecycleStatus: "departed",
      detailCode: "USER_INACTIVE",
      effectiveAt: null,
      requestId: "req_6",
    },
    isStaff: false,
  });
  assert.equal(mismatch.transitionReason, null);
  assert.equal(mismatch.lifecycleStatus, "unresolved");

  const active = resolveMattermostLifecycle({
    result: {
      mmUserId: "mm.student-1",
      username: "student_one",
      memberType: "student",
      lifecycleStatus: "active",
      detailCode: "ACTIVE",
      effectiveAt: null,
      requestId: "req_7",
    },
    isStaff: false,
  });
  assert.equal(active.transitionReason, null);
  assert.equal(active.lifecycleStatus, "active");
});
