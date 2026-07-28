import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("관리자 개인 알림은 서버 read-model과 안전한 복구 상태를 사용한다", async () => {
  const [pageSource, viewSource, readModelSource] = await Promise.all([
    readFile(
      new URL("../src/app/admin/(protected)/notifications/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/admin/AdminNotificationsView.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/admin-notifications.server.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(pageSource, /getAdminNotificationsReadModel/);
  assert.doesNotMatch(pageSource, /getSupabaseAdminClient/);
  assert.doesNotMatch(pageSource, /throw new Error/);
  assert.match(readModelSource, /admin_notification_recipients/);
  assert.match(readModelSource, /countOperationalPushSubscriptionDevices/);
  assert.doesNotMatch(readModelSource, /listOperationalPushSubscriptionDevices/);
  assert.match(readModelSource, /range\(offset, offset \+ limit\)/);
  assert.match(readModelSource, /unstable_cache/);
  assert.match(readModelSource, /ADMIN_NOTIFICATION_READ_CACHE_REVALIDATE_SECONDS/);
  assert.match(readModelSource, /revalidateTag/);
  assert.match(readModelSource, /loadError: true/);
  assert.match(viewSource, /알림을 불러오지 못했습니다/);
  assert.match(viewSource, /loadError/);
  assert.doesNotMatch(viewSource, /Error\.message/);
});
