import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("알림 템플릿 첫 화면은 테스트 수신자 조회를 기다리지 않는다", async () => {
  const [page, manager, route] = await Promise.all([
    read("src/app/admin/(protected)/notification-templates/page.tsx"),
    read("src/components/admin/AdminNotificationTemplateManager.tsx"),
    read("src/app/api/admin/notification-templates/test-recipients/route.ts"),
  ]);

  assert.doesNotMatch(page, /listNotificationTemplateTestRecipients/);
  assert.match(page, /testRecipients=\{\[\]\}/);
  assert.match(page, /defaultTestRecipientId=\{null\}/);
  assert.match(manager, /useEffect/);
  assert.match(manager, /fetch\("\/api\/admin\/notification-templates\/test-recipients"/);
  assert.match(manager, /테스트 수신 회원을 불러오는 중/);
  assert.match(
    route,
    /ensureAdminApiPermission\(\s*request,\s*"notification_templates",\s*"read",\s*\)/,
  );
  assert.match(route, /listNotificationTemplateTestRecipients/);
});
