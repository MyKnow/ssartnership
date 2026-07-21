import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../", import.meta.url);

async function readProjectFile(path: string) {
  return readFile(new URL(path, rootUrl), "utf8");
}

test("운영 로그 보존 정책은 1년 원본과 예외 hold 및 집계 보존을 계약으로 고정한다", async () => {
  const migration = await readProjectFile(
    "supabase/migrations/20260722001817_add_log_retention_policy.sql",
  );
  const schema = await readProjectFile("supabase/schema.sql");
  const eventLoggingGuide = await readProjectFile("docs/architecture/event-logging.md");

  assert.match(migration, /create table if not exists public\.log_retention_holds/);
  assert.match(migration, /input_cutoff[^\n]*interval '1 year'/);
  assert.match(migration, /cutoff > now\(\) - interval '1 year'/);
  assert.match(migration, /where hold\.log_group = 'event_logs'/);
  assert.match(migration, /delete from public\.partner_benefit_usages/);
  assert.match(migration, /grant execute on function public\.purge_expired_operational_logs[\s\S]*to service_role/);
  assert.match(schema, /create or replace function public\.purge_expired_operational_logs/);
  assert.match(eventLoggingGuide, /원본은 생성일로부터 1년간 보존한다/);
  assert.match(eventLoggingGuide, /log_retention_holds/);
});

test("로그 보존 cron은 매일 실행되고 만료 로그 수를 감사 로그에 남긴다", async () => {
  const route = await readProjectFile(
    "src/app/api/cron/purge-expired-operational-logs/route.ts",
  );
  const vercel = await readProjectFile("vercel.json");

  assert.match(route, /isAuthorizedByCronSecret/);
  assert.match(route, /purge_expired_operational_logs/);
  assert.match(route, /log_retention_purge/);
  assert.match(vercel, /\/api\/cron\/purge-expired-operational-logs/);
});
