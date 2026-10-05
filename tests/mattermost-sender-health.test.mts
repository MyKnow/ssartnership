import assert from "node:assert/strict";
import test from "node:test";

import {
  getMattermostSenderHealthFailurePolicy,
  getMattermostSenderRuntimeHealthFailureCode,
  isMattermostSenderRuntimeFailureCode,
} from "../src/lib/mattermost-senders/health.ts";

test("인증 실패는 Sender를 blocked 상태로 전환한다", () => {
  assert.deepEqual(getMattermostSenderHealthFailurePolicy("unauthorized"), {
    status: "blocked",
    blockedForSeconds: 60 * 60,
  });
  assert.deepEqual(getMattermostSenderHealthFailurePolicy("forbidden"), {
    status: "blocked",
    blockedForSeconds: 60 * 60,
  });
});

test("일시적 Mattermost 장애는 짧은 cooldown만 적용한다", () => {
  assert.deepEqual(getMattermostSenderHealthFailurePolicy("rate_limited"), {
    status: "cooldown",
    blockedForSeconds: 5 * 60,
  });
  assert.deepEqual(getMattermostSenderHealthFailurePolicy("timeout"), {
    status: "cooldown",
    blockedForSeconds: 5 * 60,
  });
  assert.deepEqual(getMattermostSenderHealthFailurePolicy("unavailable"), {
    status: "cooldown",
    blockedForSeconds: 5 * 60,
  });
});

test("대상 회원 없음과 설정 오류는 Sender 런타임 차단 사유가 아니다", () => {
  assert.equal(isMattermostSenderRuntimeFailureCode("not_found"), false);
  assert.equal(isMattermostSenderRuntimeFailureCode("test_target_unavailable"), false);
  assert.equal(getMattermostSenderHealthFailurePolicy("configuration_invalid"), null);
});

test("요청 거부(request_rejected)는 특정 요청 문제라 Sender 상태를 바꾸지 않는다", () => {
  assert.equal(getMattermostSenderHealthFailurePolicy("request_rejected"), null);
  for (const phase of ["authentication", "operation"] as const) {
    assert.equal(
      getMattermostSenderRuntimeHealthFailureCode({ code: "request_rejected", phase }),
      null,
    );
  }
});

test("로그인 뒤 대상 작업의 403은 대상별 권한 문제로 보고 Sender를 차단하지 않는다", () => {
  assert.equal(
    getMattermostSenderRuntimeHealthFailureCode({ code: "forbidden", phase: "operation" }),
    null,
  );
  assert.equal(
    getMattermostSenderRuntimeHealthFailureCode({ code: "forbidden", phase: "authentication" }),
    "forbidden",
  );
  assert.equal(
    getMattermostSenderRuntimeHealthFailureCode({ code: "unauthorized", phase: "operation" }),
    "unauthorized",
  );
  assert.equal(
    getMattermostSenderRuntimeHealthFailureCode({ code: "timeout", phase: "operation" }),
    "timeout",
  );
  assert.equal(
    getMattermostSenderRuntimeHealthFailureCode({ code: "not_found", phase: "operation" }),
    null,
  );
});
