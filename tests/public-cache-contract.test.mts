import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repositorySource = readFileSync(
  new URL(
    "../src/lib/repositories/supabase/partner-repository.supabase.ts",
    import.meta.url,
  ),
  "utf8",
);

test("공개 제휴 캐시는 DB 버전 계약을 유지하면서 버전 조회 왕복을 짧게 캐시한다", () => {
  assert.match(repositorySource, /\.from\("public_cache_versions"\)/);
  assert.match(
    repositorySource,
    /const getCachedPublicCacheVersionSnapshot = unstable_cache\([\s\S]*\.from\("public_cache_versions"\)[\s\S]*revalidate: PUBLIC_CACHE_VERSION_SNAPSHOT_SECONDS/,
  );
  assert.match(
    repositorySource,
    /tags: \[PARTNERS_CACHE_TAG, CATEGORIES_CACHE_TAG\]/,
  );
  assert.match(repositorySource, /const getPublicCacheVersionSnapshot = cache\(/);
  assert.match(repositorySource, /getPublicCacheVersionKey\(\["partners", "categories"\]\)/);
  assert.match(repositorySource, /getCachedPublicDirectoryPartnerRows\(versionKey\)/);
});

test("공개 캐시 태그와 TTL 상수는 기존 캐시 계약 값을 그대로 유지한다", async () => {
  const [tags, ttl] = await Promise.all([
    import(new URL("../src/lib/cache-tags.ts", import.meta.url).href),
    import(new URL("../src/lib/cache-ttl.ts", import.meta.url).href),
  ]);

  assert.equal(tags.PARTNERS_CACHE_TAG, "partners");
  assert.equal(tags.CATEGORIES_CACHE_TAG, "categories");
  assert.equal(tags.SSAFY_CYCLE_SETTINGS_CACHE_TAG, "ssafy-cycle-settings");
  assert.equal(ttl.ADMIN_READ_BURST_CACHE_SECONDS, 3);
  assert.equal(ttl.SLOW_CHANGING_DATA_CACHE_SECONDS, 60);
  assert.equal(ttl.PUBLIC_CACHE_VERSION_SNAPSHOT_SECONDS, 30);
});

test("관리자·파트너 무효화 헬퍼와 categories 태그 리더는 공개 캐시 태그 리터럴 대신 공용 상수를 사용한다", () => {
  for (const path of [
    "../src/app/admin/(protected)/_actions/shared-helpers.ts",
    "../src/app/partner/services/[partnerId]/request/_actions/shared.ts",
    "../src/lib/repositories/supabase/partner-repository.supabase.ts",
    "../src/lib/admin-partner-list.server.ts",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /revalidateTag\("(?:partners|categories|ssafy-cycle-settings)"/);
    assert.doesNotMatch(source, /tags: \[[^\]]*"(?:partners|categories)"/);
    assert.match(source, /from "@\/lib\/cache-tags"/);
  }
});

test("관리자 burst 캐시는 공용 3초 TTL 상수를 사용한다", async () => {
  const [taskInbox, dashboardHome] = await Promise.all([
    import(new URL("../src/lib/admin-task-inbox.ts", import.meta.url).href),
    import(new URL("../src/lib/admin-dashboard-home.server.ts", import.meta.url).href),
  ]);

  assert.equal(taskInbox.ADMIN_TASK_INBOX_CACHE_REVALIDATE_SECONDS, 3);
  assert.equal(dashboardHome.ADMIN_DASHBOARD_HOME_CACHE_REVALIDATE_SECONDS, 3);
});
