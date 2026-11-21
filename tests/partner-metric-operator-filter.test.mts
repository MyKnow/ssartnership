import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const MIGRATION = "20261005030746_harden_privileges_retention_and_lifecycle.sql";
const SIGNATURE = "public.apply_partner_metric_event_rollups(uuid, text, text, text, text, timestamp with time zone)";

async function readMigration() {
  return readFile(new URL(`supabase/migrations/${MIGRATION}`, root), "utf8");
}

test("파트너 지표 롤업은 관리자·파트너 행동을 집계 전에 제외한다", async () => {
  const migration = await readMigration();
  const start = migration.indexOf("create or replace function public.apply_partner_metric_event_rollups(");
  assert.notEqual(start, -1);
  const body = migration.slice(start, migration.indexOf("\n$$;", start));
  const earlyReturn = body.indexOf("or input_actor_type in ('admin', 'partner') then\n    return;");
  assert.ok(earlyReturn > 0, "operator actors return before any rollup write");
  assert.ok(earlyReturn < body.indexOf("insert into partner_metric_rollups"), "the filter precedes every write");
  assert.ok(earlyReturn < body.indexOf("insert into partner_metric_unique_visitors"), "the filter precedes the visitor ledger");
  for (const role of ["public", "anon", "authenticated"]) {
    assert.match(migration, new RegExp(`revoke all on function ${SIGNATURE.replace(/[()]/gu, "\\$&")} from ${role};`, "u"));
  }
});

test("기존 롤업 재계산은 원본 이력이 온전한 파트너만 대상으로 한다", async () => {
  const migration = await readMigration();
  const start = migration.indexOf("do $reconcile_partner_metric_operator_traffic$");
  assert.notEqual(start, -1);
  const block = migration.slice(start, migration.indexOf("$reconcile_partner_metric_operator_traffic$;", start));
  assert.match(block, /event_row\.actor_type in \('admin', 'partner'\)/u);
  assert.match(block, /rollup\.metric_kind = 'pv'\s+and rollup\.granularity = 'total'/u);
  assert.match(block, /if rollup_total = raw_total then\s+perform public\.reconcile_partner_metric_rollups\(target_partner_id\);/u);
  assert.match(block, /raise notice 'partner_metric_operator_reconcile_skipped:%', skipped;/u);
});
