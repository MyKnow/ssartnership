import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("알림 템플릿 상세 API는 읽기 권한과 이벤트·채널 계약을 확인한다", async () => {
  const route = await readFile(
    new URL(
      "../src/app/api/admin/notification-templates/detail/route.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    route,
    /ensureAdminApiPermission\(\s*request,\s*"notification_templates",\s*"read"/,
  );
  assert.match(route, /getNotificationTemplateDefinition\(eventKey\)/);
  assert.match(route, /definition\.channel !== channel/);
  assert.match(route, /resolveNotificationTemplate\(eventKey\)/);
  assert.match(route, /Cache-Control/);
  assert.doesNotMatch(route, /error\.message/);
});
