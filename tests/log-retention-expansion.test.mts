import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const MIGRATION = "20261005030746_harden_privileges_retention_and_lifecycle.sql";

async function read(path: string) {
  return readFile(new URL(path, root), "utf8");
}

function purgeFunction(migration: string) {
  const start = migration.indexOf("create or replace function public.purge_expired_operational_logs(");
  assert.notEqual(start, -1, "purge function is redefined");
  const end = migration.indexOf("\n$$;\n", start);
  assert.notEqual(end, -1);
  return migration.slice(start, end);
}

const ATTEMPT_TABLES = [
  "admin_login_attempts",
  "member_auth_attempts",
  "mattermost_sender_test_attempts",
  "partner_auth_attempts",
  "partner_registration_attempts",
  "password_reset_attempts",
  "suggestion_attempts",
] as const;

test("보존 purge는 기존 1년 로그 정책과 하한 가드를 유지한다", async () => {
  const body = purgeFunction(await read(`supabase/migrations/${MIGRATION}`));
  assert.match(body, /input_cutoff timestamp with time zone default now\(\) - interval '1 year'/u);
  assert.match(body, /if cutoff > now\(\) - interval '1 year' then\s+raise exception 'log_retention_cutoff_must_be_at_least_one_year_old';/u);
  for (const table of ["event_logs", "admin_audit_logs", "auth_security_logs", "push_delivery_logs", "push_message_logs", "partner_benefit_usages"]) {
    assert.match(
      body,
      new RegExp(`delete from public\\.${table}\\s+where created_at < cutoff\\s+and not public\\.log_retention_hold_active\\('${table}', ${table}\\.created_at\\);`, "u"),
    );
  }
});

test("rate-limit 시도 기록은 30일 뒤, 차단 중이 아닐 때만 지운다", async () => {
  const body = purgeFunction(await read(`supabase/migrations/${MIGRATION}`));
  assert.match(body, /attempt_cutoff timestamp with time zone := now\(\) - interval '30 days';/u);
  for (const table of ATTEMPT_TABLES) assert.match(body, new RegExp(`'${table}'`, "u"));
  assert.match(body, /pg_catalog\.to_regclass\(pg_catalog\.format\('public\.%I', attempt_table\)\) is not null/u);
  assert.match(body, /attempt\.first_attempt_at < \$1/u);
  assert.match(body, /attempt\.blocked_until is null or attempt\.blocked_until < pg_catalog\.now\(\)/u);
  assert.match(body, /log_retention_hold_active\(''rate_limit_attempts'', attempt\.first_attempt_at\)/u);
});

test("알림 발송 결과는 확정된 행만 180일 뒤 지우고 회원 알림함은 남긴다", async () => {
  const body = purgeFunction(await read(`supabase/migrations/${MIGRATION}`));
  assert.match(body, /delivery_cutoff timestamp with time zone := now\(\) - interval '180 days';/u);
  for (const table of ["notification_deliveries", "admin_notification_deliveries", "partner_notification_deliveries"]) {
    assert.match(body, new RegExp(`delete from public\\.${table} delivery[\\s\\S]*?delivery\\.status in \\('sent', 'failed', 'skipped'\\)`, "u"));
  }
  assert.match(body, /coalesce\(campaign\.metadata ->> 'campaignStatus', ''\) <> 'pending'/u);
  assert.doesNotMatch(body, /delete from public\.member_notifications/u);
});

test("업로드 세션은 만료 행만, 식별자 원장은 400일 뒤 지운다", async () => {
  const body = purgeFunction(await read(`supabase/migrations/${MIGRATION}`));
  assert.match(body, /upload_session\.status = 'expired'\s+and upload_session\.updated_at < upload_session_cutoff/u);
  assert.match(body, /upload_session_cutoff timestamp with time zone := now\(\) - interval '30 days';/u);
  assert.match(body, /identifier_cutoff_date date := \(now\(\) at time zone 'Asia\/Seoul'\)::date - 400;/u);
  assert.match(body, /delete from public\.platform_active_identities identity_row\s+where identity_row\.activity_date < identifier_cutoff_date/u);
  assert.match(body, /delete from public\.partner_metric_unique_visitors visitor/u);
  for (const key of [
    "rate_limit_attempts",
    "notification_deliveries",
    "admin_notification_deliveries",
    "partner_notification_deliveries",
    "image_upload_sessions",
    "platform_active_identities",
    "partner_metric_unique_visitors",
  ]) {
    assert.match(body, new RegExp(`'${key}', [a-z_]+_count`, "u"));
  }
});

test("모든 보존 그룹은 hold로 멈출 수 있다", async () => {
  const migration = await read(`supabase/migrations/${MIGRATION}`);
  const constraint = migration.match(/add constraint log_retention_holds_group_check\s+check \(log_group in \(([\s\S]*?)\)\);/u);
  assert.ok(constraint);
  const groups = [...constraint[1].matchAll(/'([a-z_]+)'/gu)].map((match) => match[1]);
  const body = purgeFunction(migration);
  const used = new Set([...body.matchAll(/log_retention_hold_active\(\s*'{1,2}([a-z_]+)'{1,2}/gu)].map((match) => match[1]));
  assert.deepEqual([...used].sort(), [...groups].sort());
  assert.match(migration, /create or replace function public\.log_retention_hold_active\(\s+p_log_group text,\s+p_recorded_at timestamp with time zone\s+\)/u);
});

test("보존 결정표는 migration 기본값과 같은 기간을 적는다", async () => {
  const doc = await read("docs/security/data-lifecycle.md");
  assert.match(doc, /## 보존·파기 결정표/u);
  assert.match(doc, /시도 창 시작 후 30일/u);
  assert.match(doc, /생성 후 180일/u);
  assert.match(doc, /`expired` 행은 만료 후 30일/u);
  assert.match(doc, /\| 400일\./u);
  for (const table of ATTEMPT_TABLES) assert.match(doc, new RegExp(`\`${table}\``, "u"));
  assert.match(doc, /PVE·관리 Mac 외부 사본 \| 기본 30일/u);
  assert.doesNotMatch(doc, /sync:preview|supabase-sync-preview/u);
});
