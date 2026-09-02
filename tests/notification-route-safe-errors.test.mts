import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  NotificationRequestError,
  getSafeNotificationRouteError,
} from "../src/lib/notifications/safe-error.ts";

const routePaths = [
  "src/app/api/push/subscribe/route.ts",
  "src/app/api/push/unsubscribe/route.ts",
  "src/app/api/push/subscriptions/route.ts",
  "src/app/api/notifications/route.ts",
  "src/app/api/notifications/[id]/route.ts",
  "src/app/api/notifications/preferences/route.ts",
  "src/app/api/partner/push/subscribe/route.ts",
  "src/app/api/partner/push/unsubscribe/route.ts",
  "src/app/api/partner/notifications/route.ts",
  "src/app/api/partner/notifications/[id]/route.ts",
  "src/app/api/partner/notifications/preferences/route.ts",
] as const;

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("notification routes expose only request errors or fixed recovery messages", () => {
  for (const path of routePaths) {
    const source = readSource(path);
    assert.doesNotMatch(
      source,
      /error instanceof Error\s*\?\s*error\.message/,
      path,
    );
    assert.doesNotMatch(source, /message:\s*error\.message/, path);
    assert.match(source, /getSafeNotificationRouteError/, path);
  }
});

test("notification error normalization preserves only explicit request errors", () => {
  assert.deepEqual(
    getSafeNotificationRouteError(
      new NotificationRequestError("요청 본문 형식을 확인해 주세요."),
      "알림을 처리하지 못했습니다.",
    ),
    { message: "요청 본문 형식을 확인해 주세요.", status: 400 },
  );
  assert.deepEqual(
    getSafeNotificationRouteError(
      new Error("postgres://service_role:secret@internal/notifications"),
      "알림을 처리하지 못했습니다.",
    ),
    { message: "알림을 처리하지 못했습니다.", status: 503 },
  );
});

test("push database wrappers keep provider details out of their public message", () => {
  const source = readSource("src/lib/push/config.ts");
  assert.doesNotMatch(source, /error\?\.message\?\.trim\(\)\s*\|\|\s*message/);
  assert.match(source, /cause/);
});

test("notification repository errors use stable messages", () => {
  const source = readSource(
    "src/lib/repositories/supabase/notification-repository.supabase.ts",
  );
  assert.doesNotMatch(source, /new Error\([^\n]*\.message\)/);
  assert.match(source, /createNotificationStorageError/);
});
