import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNotificationPreferencePatch,
  parseNotificationPreferencePatch,
} from "@/lib/notifications/preference-patch";

const policy = { id: "70000000-0000-4000-8000-000000000001", version: 2 };

test("한 스위치 변경은 다른 탭의 마케팅 설정을 다시 전송하지 않는다", () => {
  assert.deepEqual(buildNotificationPreferencePatch("mmEnabled", false, policy), {
    mmEnabled: false,
  });
  assert.deepEqual(buildNotificationPreferencePatch("reviewEnabled", true, policy), {
    reviewEnabled: true, enabled: true,
  });
  assert.deepEqual(buildNotificationPreferencePatch("reviewEnabled", false, policy), {
    reviewEnabled: false,
  });
});

test("명시적 마케팅 동의에만 검토한 정책 ID와 버전을 보낸다", () => {
  const patch = buildNotificationPreferencePatch("marketingEnabled", true, policy);
  assert.deepEqual(patch, {
    marketingEnabled: true, marketingPolicyId: policy.id, marketingPolicyVersion: 2,
  });
  assert.equal(parseNotificationPreferencePatch(patch).ok, true);
  assert.deepEqual(buildNotificationPreferencePatch("marketingEnabled", false, null), {
    marketingEnabled: false,
  });
  assert.equal(parseNotificationPreferencePatch(
    buildNotificationPreferencePatch("marketingEnabled", true, null),
  ).ok, false);
});

test("동의 증거 누락과 잘못된 원시 입력은 FE와 API의 공통 규칙으로 거부한다", () => {
  for (const input of [null, [], true, {}, { mmEnabled: "false" },
    { marketingEnabled: true },
    { marketingEnabled: true, marketingPolicyId: policy.id, marketingPolicyVersion: 0 },
    { marketingEnabled: true, marketingPolicyId: "invalid", marketingPolicyVersion: 2 },
    { marketingEnabled: false, marketingPolicyId: policy.id, marketingPolicyVersion: 2 },
    { mmEnabled: false, marketingPolicyId: policy.id, marketingPolicyVersion: 2 },
  ]) assert.equal(parseNotificationPreferencePatch(input).ok, false, JSON.stringify(input));
  assert.deepEqual(parseNotificationPreferencePatch({ mmEnabled: false }), {
    ok: true, value: { mmEnabled: false },
  });
});
