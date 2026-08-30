import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("알림 템플릿은 조회·수정·복원 권한에 맞춰 작업을 노출한다", async () => {
  const [page, manager] = await Promise.all([
    read("src/app/admin/(protected)/notification-templates/page.tsx"),
    read("src/components/admin/AdminNotificationTemplateManager.tsx"),
  ]);

  assert.match(page, /requireNotificationTemplateAdmin\("read"/);
  assert.match(
    page,
    /canAdmin\(\s*session\.account\.permissions,\s*"notification_templates",\s*"update"/,
  );
  assert.match(
    page,
    /canAdmin\(\s*session\.account\.permissions,\s*"notification_templates",\s*"delete"/,
  );
  assert.match(page, /canUpdate=\{canAdmin/);
  assert.match(page, /canDelete=\{canAdmin/);
  assert.match(manager, /canUpdate = true/);
  assert.match(manager, /canDelete = true/);
  assert.match(manager, /canUpdate \?/);
  assert.match(manager, /canDelete \?/);
  assert.match(manager, /조회 전용 권한/);
  assert.match(manager, /테스트 발송 권한이 없습니다/);
});

test("알림 템플릿 API도 위임 불가 Super Admin 게이트를 공유한다", async () => {
  const [access, detailRoute, recipientsRoute] = await Promise.all([
    read("src/lib/admin-access.ts"),
    read("src/app/api/admin/notification-templates/detail/route.ts"),
    read("src/app/api/admin/notification-templates/test-recipients/route.ts"),
  ]);

  assert.match(access, /export async function getNotificationTemplateAdminApiSession/);
  assert.match(access, /session\.account\.permissionId === "super_admin"/);
  assert.match(access, /reason: "super_admin_required"/);
  assert.match(access, /status: 403/);
  for (const route of [detailRoute, recipientsRoute]) {
    assert.match(route, /getNotificationTemplateAdminApiSession/);
    assert.doesNotMatch(route, /ensureAdminApiPermission/);
  }
});
