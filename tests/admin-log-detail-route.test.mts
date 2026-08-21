import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("로그 상세 API는 로그 그룹 권한과 PII 응답 정책을 확인한다", async () => {
  const route = await readFile(
    new URL(
      "../src/app/api/admin/logs/[group]/[id]/route.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(route, /ensureAdminApiPermission\(request, "logs", "read"\)/);
  assert.match(route, /getAdminLogAccessPolicy/);
  assert.match(route, /access\.readGroups\.includes\(rawGroup\)/);
  assert.match(route, /\.select\("id,properties"\)/);
  assert.match(route, /access\.includePii/);
  assert.match(route, /Cache-Control/);
  assert.doesNotMatch(route, /error\.message/);
});
