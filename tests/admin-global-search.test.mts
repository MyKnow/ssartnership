import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminGlobalSearchModulePromise = import(
  new URL("../src/lib/admin-global-search.ts", import.meta.url).href,
) as Promise<typeof import("../src/lib/admin-global-search.ts")>;

test("통합 검색어는 공백을 정리하고 안전한 관리자 URL로만 직렬화한다", async () => {
  const {
    buildAdminGlobalSearchHref,
    normalizeAdminGlobalSearchQuery,
  } = await adminGlobalSearchModulePromise;

  assert.equal(normalizeAdminGlobalSearchQuery("  르블라썸\n 강남점  "), "르블라썸 강남점");
  assert.equal(normalizeAdminGlobalSearchQuery("   "), "");
  assert.equal(buildAdminGlobalSearchHref("르블라썸 강남점"), "/admin/search?q=%EB%A5%B4%EB%B8%94%EB%9D%BC%EC%8D%B8+%EA%B0%95%EB%82%A8%EC%A0%90");
  assert.equal(buildAdminGlobalSearchHref("   "), "/admin/search");
});

test("빠른 찾기는 Enter로 실제 대상 검색으로 이동하고 검색 결과는 서비스 경계에서 최소 필드만 조회한다", async () => {
  const [navigatorSource, pageSource, searchServiceSource] = await Promise.all([
    readFile(
      new URL("../src/components/admin/AdminQuickNavigator.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/admin/(protected)/search/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/admin-global-search.server.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(navigatorSource, /buildAdminGlobalSearchHref/);
  assert.match(navigatorSource, /router\.push\(/);
  assert.match(navigatorSource, /onSubmit=/);
  assert.match(navigatorSource, /ariaLabel="회원·제휴처 검색"/);
  assert.match(pageSource, /canAdmin\(adminSession\.account\.permissions, "members", "read"\)/);
  assert.match(pageSource, /canAdmin\(adminSession\.account\.permissions, "brands", "read"\)/);
  assert.match(pageSource, /searchAdminGlobalEntities/);
  assert.doesNotMatch(pageSource, /getSupabaseAdminClient/);
  assert.match(
    searchServiceSource,
    /\.overlaps\(\s*"managed_campus_slugs",\s*managedCampusSlugs,\s*\)/,
  );
  assert.match(searchServiceSource, /\.limit\(8\)/);
  assert.doesNotMatch(searchServiceSource, /\.select\("\*"\)/);
  assert.doesNotMatch(searchServiceSource, /Error\.message/);
});

test("검색 결과 상세 이동은 검증된 returnTo로 검색 맥락을 보존한다", async () => {
  const [memberDetailSource, partnerDetailSource, resultsSource] = await Promise.all([
    readFile(
      new URL("../src/app/admin/(protected)/members/[memberId]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/admin/(protected)/partners/[partnerId]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/admin/AdminGlobalSearchResultsView.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(memberDetailSource, /sanitizeAdminReturnTo/);
  assert.match(partnerDetailSource, /sanitizeAdminReturnTo/);
  assert.match(resultsSource, /URLSearchParams\(\{ returnTo \}\)/);
});

test("통합 검색은 느린 조회 중에도 검색 구조를 유지하는 전용 skeleton을 제공한다", async () => {
  const [loadingSource, skeletonSource, contentSource] = await Promise.all([
    readFile(
      new URL("../src/app/admin/(protected)/search/loading.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/loading/AdminPageSkeletons.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/loading/AdminGlobalSearchSkeletonContent.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(loadingSource, /AdminGlobalSearchSkeleton/);
  assert.match(skeletonSource, /AdminGlobalSearchSkeletonContent/);
  assert.match(skeletonSource, /AdminShell title="통합 검색"/);
  assert.match(contentSource, /export function AdminGlobalSearchSkeletonContent/);
});
