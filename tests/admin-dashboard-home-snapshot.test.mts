import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("관리 홈 집계 RPC는 권한 범위별 수치만 반환하고 service role로 제한한다", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260726040015_add_admin_dashboard_home_snapshot.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /get_admin_dashboard_home_snapshot\(/);
  assert.match(migration, /input_managed_campus_slugs text\[\] default null/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /partner\.managed_campus_slugs && scope\.managed_campus_slugs/);
  assert.match(migration, /admin_id = input_admin_id/);
  assert.match(migration, /grant execute on function public\.get_admin_dashboard_home_snapshot\(uuid, text\[\]\) to service_role/);
  assert.doesNotMatch(migration, /security definer/);
});
