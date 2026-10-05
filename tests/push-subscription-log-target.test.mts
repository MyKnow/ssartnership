import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getPushSubscriptionLogTargetId } from "../src/lib/push/log-target.ts";

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("푸시 구독 로그 대상 ID는 UUID만 허용한다", () => {
  assert.equal(
    getPushSubscriptionLogTargetId(" 6F9619FF-8B86-4D01-B42D-00CF4FC964FF "),
    "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
  );
  for (const value of [
    "https://fcm.googleapis.com/fcm/send/secret-token",
    "https://web.push.apple.com/QGx-secret",
    "not-a-uuid",
    "",
    null,
    undefined,
  ]) {
    assert.equal(getPushSubscriptionLogTargetId(value), null, String(value));
  }
});

test("회원 푸시 구독·해지 이벤트는 endpoint URL을 target_id로 저장하지 않는다", () => {
  const unsubscribe = readSource("src/app/api/push/unsubscribe/route.ts");
  assert.match(unsubscribe, /getPushSubscriptionLogTargetId\(body\?\.subscriptionId\)/);
  assert.doesNotMatch(unsubscribe, /targetId:[\s\S]{0,120}body\?\.endpoint/);

  const subscribe = readSource("src/app/api/push/subscribe/route.ts");
  assert.match(subscribe, /targetType: "push_subscription",\s*\/\/[^\n]*\n\s*targetId: null,/);
  assert.doesNotMatch(subscribe, /targetId: body\.subscription\.endpoint/);
});
