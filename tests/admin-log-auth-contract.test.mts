import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("로그 API는 권한 확인에서 읽은 관리자 세션을 재사용한다", async () => {
  const [accessSource, routeSource] = await Promise.all([
    readFile(new URL("../src/lib/admin-access.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/logs/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(accessSource, /export async function getAdminApiPermissionSession/);
  assert.match(accessSource, /return \{ session \} satisfies AdminApiPermissionResult/);
  assert.match(routeSource, /getAdminApiPermissionSession\(request, 'logs', 'read'\)/);
  assert.match(routeSource, /getAdminLogAccessPolicy\(auth\.session\.account\)/);
  assert.doesNotMatch(routeSource, /ensureAdminApiPermission|getAdminSession|timing\.measure\('session'/);
});
