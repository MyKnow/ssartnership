import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const rootUrl = new URL("../", import.meta.url);

async function readProjectFile(path: string) {
  return readFile(new URL(path, rootUrl), "utf8");
}

test("스코프 로그 RPC는 허용 그룹과 PII 여부를 SQL에서 받고 service role로만 실행한다", async () => {
  const migration = await readProjectFile(
    "supabase/migrations/20260715031731_add_scoped_admin_log_rpcs.sql",
  );

  assert.match(migration, /get_admin_logs_page_scoped/);
  assert.match(migration, /get_admin_logs_summary_scoped/);
  assert.match(migration, /input_allowed_groups text\[\]/);
  assert.match(migration, /input_include_pii boolean/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /left join public\.mm_user_directory directory/);
  assert.doesNotMatch(migration, /members\.mm_username/);
  assert.match(migration, /case when params\.include_pii then event_logs\.path else null end as path/);
  assert.doesNotMatch(migration, /\n\s+event_logs\.path,\n\s+event_logs\.target_type,/);
  assert.doesNotMatch(migration, /\n\s+admin_audit_logs\.path,\n\s+admin_audit_logs\.target_type,/);
  assert.doesNotMatch(migration, /\n\s+auth_security_logs\.path,\n\s+case when params\.include_pii then members\.display_name end,/);
  assert.match(migration, /'topPaths', case when \(select include_pii from params\)/);
  assert.match(migration, /revoke all on function public\.get_admin_logs_page_scoped[\s\S]*from public/);
  assert.match(migration, /grant execute on function public\.get_admin_logs_summary_scoped[\s\S]*to service_role/);

  const schema = await readProjectFile("supabase/schema.sql");
  const schemaSnapshotIndex = schema.indexOf("-- Snapshot of 20260715031731_add_scoped_admin_log_rpcs.sql");
  assert.ok(schemaSnapshotIndex > schema.indexOf("add column if not exists mattermost_account_id uuid"));
  assert.match(schema, /create or replace function public\.get_admin_logs_page_scoped/);
  assert.match(schema, /create or replace function public\.get_admin_logs_summary_scoped/);
});

test("CSV 내보내기는 POST same-origin 요청과 감사 기록 성공을 요구한다", async () => {
  const route = await readProjectFile("src/app/api/admin/logs/export/route.ts");

  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /export async function GET/);
  assert.match(route, /isTrustedSameOriginRequest/);
  assert.match(route, /allowedContentTypes: \['application\/json'\]/);
  assert.match(route, /selectAllowedLogGroups/);
  assert.match(route, /admin_log_export_requested/);
  assert.match(route, /if \(!auditRecorded\)/);
  assert.match(route, /'X-Content-Type-Options': 'nosniff'/);
});
