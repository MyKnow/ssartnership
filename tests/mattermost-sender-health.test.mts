import assert from "node:assert/strict";
import test from "node:test";

import {
  getMattermostSenderHealthFailurePolicy,
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
