import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const schemaSql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const migrationNames = readdirSync(migrationDirectory);

function readMigration(name: string) {
  return readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
}

test("플랫폼 활성 식별자는 RLS와 서버 전용 권한으로 보관한다", () => {
  assert.match(schemaSql, /create\s+table\s+if\s+not\s+exists\s+(?:public\.)?platform_active_identities/i);
  assert.match(schemaSql, /alter\s+table\s+(?:public\.)?platform_active_identities\s+enable\s+row\s+level\s+security\s*;/i);

  for (const role of ["anon", "authenticated"] as const) {
    assert.match(
      schemaSql,
      new RegExp(
        `revoke\\s+all\\s+on\\s+table\\s+(?:public\\.)?platform_active_identities\\s+from\\s+${role}\\s*;`,
        "i",
      ),
    );
  }
});

test("활성 사용자 집계는 회원과 비로그인 세션을 분리하고 재실행 가능한 로그 백필을 제공한다", () => {
  assert.match(schemaSql, /create\s+or\s+replace\s+function\s+public\.platform_activity_identity_key\(/i);
  assert.match(schemaSql, /create\s+trigger\s+platform_activity_from_event_logs/i);
  assert.match(schemaSql, /revoke\s+all\s+on\s+function\s+public\.sync_platform_activity_from_event_logs\(\)\s+from\s+public\s*;/i);
  assert.match(schemaSql, /create\s+or\s+replace\s+function\s+public\.get_admin_platform_activity_metrics\(/i);
  assert.match(schemaSql, /grant\s+execute\s+on\s+function\s+public\.get_admin_platform_activity_metrics\([^;]+to\s+service_role/i);

  const backfillMigration = migrationNames.find((name) =>
    name.endsWith("_backfill_platform_activity_metrics.sql"),
  );
  assert.ok(backfillMigration, "활성 지표 백필 마이그레이션이 필요합니다.");
  const backfillSql = readMigration(backfillMigration);
  assert.match(backfillSql, /insert\s+into\s+public\.platform_active_identities/i);
  assert.match(backfillSql, /on\s+conflict\s*\(activity_date,\s*identity_kind,\s*identity_hash\)/i);

  const seriesMigration = migrationNames.find((name) =>
    name.endsWith("_extend_platform_activity_series.sql"),
  );
  assert.ok(seriesMigration, "활성 추이 확장 migration이 필요합니다.");
  assert.match(readMigration(seriesMigration), /as_of_date\s*-\s*83/i);
});
