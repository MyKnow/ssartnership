import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("관리자 로그 cursor RPC는 안정적인 keyset과 service role 경계를 유지한다", async () => {
  const source = await readFile(
    new URL(
      "../supabase/migrations/20260727150124_add_scoped_admin_log_cursor_rpc.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /create or replace function public\.get_admin_logs_cursor_scoped/);
  assert.match(source, /input_cursor_created_at timestamp with time zone default null/);
  assert.match(source, /input_cursor_id uuid default null/);
  assert.match(source, /security invoker/);
  assert.match(source, /counted_logs as \(\s*select filtered_logs\.\*, count\(\*\) over \(\) as total_count/);
  assert.match(
    source,
    /counted_logs\.created_at < input_cursor_created_at[\s\S]*or[\s\S]*\([\s\S]*counted_logs\.created_at = input_cursor_created_at[\s\S]*and input_cursor_id is not null[\s\S]*and counted_logs\.id < input_cursor_id/,
  );
  assert.match(source, /order by cursor_logs\.created_at desc, cursor_logs\.id desc/);
  assert.match(source, /limit \(select page_size from params\)/);
  assert.match(source, /revoke all on function public\.get_admin_logs_cursor_scoped[\s\S]*/);
  assert.match(source, /\) from public;/);
  assert.match(source, /\) from anon;/);
  assert.match(source, /\) from authenticated;/);
  assert.match(source, /\) to service_role;/);
});
