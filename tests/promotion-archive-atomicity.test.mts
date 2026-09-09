import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260831132700_archive_expired_promotions_atomically.sql",
  import.meta.url,
);
const schemaPath = new URL("../supabase/schema.sql", import.meta.url);
const routePath = new URL(
  "../src/app/api/cron/archive-expired-promotions/route.ts",
  import.meta.url,
);

test("만료 프로모션 정리 RPC는 이벤트와 슬라이드를 하나의 service-role 전용 함수로 보관 처리한다", async () => {
  const [migration, schema, route] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(schemaPath, "utf8"),
    readFile(routePath, "utf8"),
  ]);

  assert.match(
    migration,
    /create or replace function public\.archive_expired_promotions_batch\(\s*input_now timestamp with time zone default pg_catalog\.clock_timestamp\(\),\s*input_limit integer default 100\s*\)/,
  );
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = pg_catalog, public/);
  assert.match(
    migration,
    /limit least\(greatest\(coalesce\(input_limit, 100\), 1\), 100\)/,
  );
  assert.match(migration, /for update of promotion_events skip locked/);
  assert.match(
    migration,
    /update public\.promotion_events[\s\S]*set is_active = false[\s\S]*returning slug/,
  );
  assert.match(
    migration,
    /update public\.promotion_slides[\s\S]*set is_active = false[\s\S]*event_slug in \(select archived_events\.slug from archived_events\)[\s\S]*returning id/,
  );
  assert.match(
    migration,
    /returns table \(\s*archived_event_slugs text\[\],\s*archived_slide_count bigint\s*\)/,
  );
  assert.match(
    migration,
    /revoke all on function public\.archive_expired_promotions_batch\(timestamp with time zone, integer\) from authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.archive_expired_promotions_batch\(timestamp with time zone, integer\) to service_role;/,
  );
  assert.ok(schema.includes(migration.trim()));

  assert.match(route, /rpc\("archive_expired_promotions_batch"/);
  assert.match(route, /input_limit: ARCHIVE_EVENT_BATCH_SIZE/);
  assert.match(route, /const slugs = Array\.isArray\(row\.archived_event_slugs\)/);
  assert.match(route, /const archivedSlides = Number\(row\.archived_slide_count \?\? 0\)/);
  assert.doesNotMatch(route, /\.from\("promotion_events"\)\s*\.select\("slug"\)/);
  assert.doesNotMatch(route, /\.from\("promotion_events"\)\s*\.update\(\{ is_active: false \}\)/);
  assert.doesNotMatch(route, /\.from\("promotion_slides"\)\s*\.update\(\{ is_active: false \}\)/);
});
