import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("관리 홈 집계 RPC는 권한 범위별 수치만 반환하고 service role로 제한한다", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260726103524_expand_admin_dashboard_home_task_snapshot.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /get_admin_dashboard_home_snapshot\(/);
  assert.match(migration, /input_managed_campus_slugs text\[\] default null/);
  assert.match(migration, /input_include_brand_queues boolean default false/);
  assert.match(migration, /input_include_graduate_verifications boolean default false/);
  assert.match(migration, /input_include_signup_requests boolean default false/);
  assert.match(migration, /input_include_profile_photos boolean default false/);
  assert.match(migration, /input_include_notifications boolean default false/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /case when input_include_graduate_verifications then/);
  assert.match(migration, /case when input_include_signup_requests then/);
  assert.match(migration, /case when input_include_profile_photos then/);
  assert.match(migration, /partner\.managed_campus_slugs && scope\.managed_campus_slugs/);
  assert.match(migration, /admin_id = input_admin_id/);
  assert.match(migration, /grant execute on function public\.get_admin_dashboard_home_snapshot\(uuid, text\[\], boolean, boolean, boolean, boolean, boolean\) to service_role/);
  assert.doesNotMatch(migration, /security definer/);
});

test("관리 홈은 read model이 준비되는 동안 관리자 셸을 먼저 스트리밍한다", async () => {
  const pageSource = await readFile(
    new URL("../src/app/admin/(protected)/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(pageSource, /<AdminShell title="관리 홈">/);
  assert.match(
    pageSource,
    /<Suspense fallback=\{<AdminDashboardSkeletonContent \/>\}>/,
  );
  assert.match(pageSource, /function AdminDashboardContent/);
  assert.match(pageSource, /async function AdminDashboardData/);
  assert.match(pageSource, /const cycleSettingsPromise = getSsafyCycleSettings\(\);/);
  assert.match(pageSource, /<AdminDashboardCycleMeta settingsPromise=\{cycleSettingsPromise\} \/>/);
  assert.doesNotMatch(pageSource, /Promise\.all\(\[\s*cycleSettingsPromise/);
});

test("관리 홈 read-model은 느린 RPC를 안전한 오류 상태로 제한한다", async () => {
  const source = await readFile(
    new URL("../src/lib/admin-dashboard-home.server.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /withAdminReadModelTimeout/);
  assert.match(source, /ADMIN_DASHBOARD_READ_MODEL_TIMEOUT_MS/);
  assert.match(source, /hasError: true/);
});

test("관리 홈 snapshot은 권한 범위를 포함한 짧은 서버 캐시를 사용한다", async () => {
  const source = await readFile(
    new URL("../src/lib/admin-dashboard-home.server.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /unstable_cache/);
  assert.match(source, /ADMIN_DASHBOARD_HOME_CACHE_REVALIDATE_SECONDS = 3/);
  assert.match(source, /getCachedAdminDashboardHomeSnapshot\(\{/);
  assert.match(source, /managedCampusSlugs: getManagedCampusFilterValues\(account\)/);
});

test("기수 설정은 짧은 서버 캐시를 사용하고 cycle 변경 시 즉시 무효화한다", async () => {
  const [settingsSource, helpersSource] = await Promise.all([
    readFile(new URL("../src/lib/ssafy-cycle-settings.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/admin/(protected)/_actions/shared-helpers.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(settingsSource, /unstable_cache/);
  assert.match(settingsSource, /revalidate: SSAFY_CYCLE_SETTINGS_CACHE_SECONDS/);
  assert.match(settingsSource, /tags: \[SSAFY_CYCLE_SETTINGS_CACHE_TAG\]/);
  assert.match(settingsSource, /const SSAFY_CYCLE_SETTINGS_CACHE_SECONDS = 60/);
  assert.match(helpersSource, /revalidateTag\("ssafy-cycle-settings", "max"\)/);
});
