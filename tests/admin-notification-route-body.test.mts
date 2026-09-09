import assert from "node:assert/strict";
import test from "node:test";

import {
  AdminNotificationRouteBodyError,
  MAX_ADMIN_NOTIFICATION_JSON_BODY_BYTES,
  readAdminNotificationJsonBody,
} from "../src/lib/admin-notification-route-body.ts";

test("관리자 알림 본문 helper는 선언된 content-length 초과를 413으로 거부한다", async () => {
  const request = new Request("https://example.com/api/push/admin/preview", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(MAX_ADMIN_NOTIFICATION_JSON_BODY_BYTES + 1),
    },
    body: JSON.stringify({ title: "공지", body: "본문" }),
  });

  await assert.rejects(
    readAdminNotificationJsonBody(request),
    (error: unknown) =>
      error instanceof AdminNotificationRouteBodyError &&
      error.status === 413 &&
      error.message === "알림 요청 본문이 너무 큽니다.",
  );
});

test("관리자 알림 본문 helper는 잘못된 JSON을 안전한 400 오류로 바꾼다", async () => {
  const request = new Request("https://example.com/api/push/admin/preview", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "{",
  });

  await assert.rejects(
    readAdminNotificationJsonBody(request),
    (error: unknown) =>
      error instanceof AdminNotificationRouteBodyError &&
      error.status === 400 &&
      error.message === "알림 요청 본문 형식을 확인해 주세요.",
  );
});

test("관리자 알림 본문 helper는 허용 길이의 4-byte 문자를 JSON framing과 함께 수용한다", async () => {
  const payload = {
    title: "😀".repeat(1_000),
    body: "😀".repeat(10_000),
  };
  const request = new Request("https://example.com/api/push/admin/preview", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  assert.deepEqual(await readAdminNotificationJsonBody(request), payload);
});
