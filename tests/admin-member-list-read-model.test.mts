import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseAdminMemberListFilters,
  parseAdminMemberPage,
} from "../src/lib/admin-member-list.server.ts";

const memberPagePath = new URL(
  "../src/app/admin/(protected)/members/page.tsx",
  import.meta.url,
);
const memberReadModelPath = new URL(
  "../src/lib/admin-member-list.server.ts",
  import.meta.url,
);

test("관리자 회원 목록은 페이지에서 DB 조회를 분리하고 서버 read-model로 페이지네이션한다", async () => {
  const [pageSource, readModelSource] = await Promise.all([
    readFile(memberPagePath, "utf8"),
    readFile(memberReadModelPath, "utf8"),
  ]);

  assert.match(pageSource, /getAdminMemberListReadModel/);
  assert.doesNotMatch(pageSource, /getSupabaseAdminClient/);
  assert.match(readModelSource, /rpc\("get_admin_member_list_page"/);
  assert.match(readModelSource, /input_offset: from/);
  assert.match(readModelSource, /input_page_size: pageSize/);
  assert.match(readModelSource, /input_trend_limit: ADMIN_MEMBER_TREND_SAMPLE_LIMIT/);
  assert.match(readModelSource, /\.in\("id", memberIds\)/);
  assert.match(readModelSource, /orderAdminMemberRowsByPage/);
  assert.doesNotMatch(readModelSource, /memberQuery\.range\(/);
  assert.match(readModelSource, /shouldRedirectToLastPage: page > totalPages/);
  assert.match(readModelSource, /getAdminSearchLikePattern\(filters\.searchValue\)/);
  assert.match(readModelSource, /is\("deleted_at", null\)/);
  assert.match(pageSource, /redirect\(`\/admin\/members\?/);
});

test("회원 부분 검색은 한국어·Mattermost 필드용 trigram 인덱스를 사용한다", async () => {
  const [migrationSource, emailSearchMigration] = await Promise.all([
    readFile(
      new URL(
        "../supabase/migrations/20260727113746_optimize_admin_member_search.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260821001338_add_admin_member_password_reset.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(migrationSource, /create extension if not exists pg_trgm/i);
  assert.match(migrationSource, /members_admin_display_name_trgm_idx/);
  assert.match(migrationSource, /members_admin_manual_login_id_trgm_idx/);
  assert.match(migrationSource, /mm_user_directory_admin_username_trgm_idx/);
  assert.match(migrationSource, /mm_user_directory_admin_user_id_trgm_idx/);
  assert.match(migrationSource, /using gin \(display_name gin_trgm_ops\)/);
  assert.match(migrationSource, /where deleted_at is null/);
  assert.match(emailSearchMigration, /members_admin_email_normalized_trgm_idx/);
  assert.match(emailSearchMigration, /email_normalized extensions\.gin_trgm_ops/);
});

test("회원 목록은 추이 query를 핵심 목록과 분리해 먼저 렌더링할 수 있다", async () => {
  const [pageSource, readModelSource, trendSectionSource] = await Promise.all([
    readFile(memberPagePath, "utf8"),
    readFile(memberReadModelPath, "utf8"),
    readFile(
      new URL(
        "../src/components/admin/AdminMemberTrendSection.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(pageSource, /<Suspense/);
  assert.match(pageSource, /<AdminMemberTrendSection/);
  assert.match(readModelSource, /indexRow\.trend_created_ats/);
  assert.match(readModelSource, /Promise\.resolve<AdminMemberTrendReadModel>/);
  assert.match(readModelSource, /isSampled: totalCount > trendCreatedAts\.length/);
  assert.match(trendSectionSource, /await trend/);
});

test("회원 목록 운영 요약은 핵심 목록과 분리해 스트리밍한다", async () => {
  const [pageSource, readModelSource, summarySectionSource] = await Promise.all([
    readFile(memberPagePath, "utf8"),
    readFile(memberReadModelPath, "utf8"),
    readFile(
      new URL(
        "../src/components/admin/AdminMemberSummarySection.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(pageSource, /AdminMemberSummaryFallback/);
  assert.match(pageSource, /<AdminMemberSummarySection/);
  assert.match(readModelSource, /memberSummary/);
  assert.match(readModelSource, /memberEnrichmentPromise/);
  assert.match(readModelSource, /hasPolicyConsentFilter/);
  assert.match(summarySectionSource, /await summary/);
  assert.match(summarySectionSource, /확인 불가/);
  assert.match(summarySectionSource, /정책 상태 요약을 불러오지 못했습니다/);
});

test("회원 목록 read-model은 오류를 안전한 상태로 돌려준다", async () => {
  const source = await readFile(memberReadModelPath, "utf8");

  assert.match(source, /hasMemberLoadError/);
  assert.match(source, /withAdminReadModelTimeout/);
  assert.match(source, /ADMIN_MEMBER_READ_MODEL_TIMEOUT_MS/);
  assert.match(
    source,
    /profile_images:member_profile_images!member_profile_images_member_id_fkey\(status\)/,
  );
  assert.match(source, /directory:mm_user_directory!members_mattermost_account_id_fkey/);
  assert.doesNotMatch(source, /getCurrentMemberProfileImageMemberIds/);
  assert.doesNotMatch(source, /getMmUserDirectoryEntriesByAccountIds/);
  assert.match(source, /unstable_cache/);
  assert.match(source, /ADMIN_MEMBER_OPTIONS_CACHE_REVALIDATE_SECONDS = 60/);
  assert.match(source, /getCachedAdminMemberOptions\(\)/);
  assert.match(source, /ADMIN_MEMBER_POLICY_CACHE_REVALIDATE_SECONDS = 3/);
  assert.match(source, /getCachedAdminMemberPolicyContext\(\)/);
  assert.match(source, /select\("id,kind,version"\)/);
  assert.doesNotMatch(source, /select\(POLICY_SELECT\)/);
  assert.doesNotMatch(source, /getMemberProfilePhotoStates\(memberIds\)/);
  assert.match(source, /input_search_pattern:/);
  assert.match(source, /getAdminSearchLikePattern\(filters\.searchValue\)/);
  assert.match(source, /input_service_policy_id:/);
  assert.match(source, /input_marketing_enabled:/);
  assert.doesNotMatch(source, /getMemberSearchIds/);
  assert.doesNotMatch(source, /getPreferenceFilteredMemberIds/);
  assert.doesNotMatch(source, /getPolicyConsentFilteredMemberIds/);
  assert.doesNotMatch(source, /getSsafyCycleSettings/);
  assert.doesNotMatch(source, /cycleSettings/);
  assert.doesNotMatch(source, /Error\.message/);
});

test("기수 전체 MM 중단은 실제 변경 대상 수를 별도로 계산해 UI에 전달한다", async () => {
  const [pageSource, readModelSource, operationsSource] = await Promise.all([
    readFile(memberPagePath, "utf8"),
    readFile(memberReadModelPath, "utf8"),
    readFile(
      new URL(
        "../src/components/admin/AdminMemberOperationsPanel.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(readModelSource, /generationMattermostLoginTargetCount/);
  assert.match(readModelSource, /count: "exact", head: true/);
  assert.match(readModelSource, /\.not\("mattermost_account_id", "is", null\)/);
  assert.match(readModelSource, /\.is\("mattermost_login_disabled_at", null\)/);
  assert.match(pageSource, /generationMattermostLoginTargetCount/);
  assert.match(operationsSource, /실행 대상/);
  assert.match(operationsSource, /이미 MM 이용이 중단된 회원은 다시 변경하지 않습니다/);
});

test("회원 수동 추가의 기수 설정은 핵심 목록과 분리해 스트리밍한다", async () => {
  const pageSource = await readFile(memberPagePath, "utf8");

  assert.match(pageSource, /AdminMemberManualAddFallback/);
  assert.match(pageSource, /<AdminMemberManualAddSection/);
  assert.match(pageSource, /getSsafyCycleSettings\(\)\.catch/);
});

test("회원 고급 필터는 전체 ID 집합 대신 DB 페이지 RPC에 전달한다", async () => {
  const source = await readFile(memberReadModelPath, "utf8");

  assert.match(source, /rpc\("get_admin_member_list_page"/);
  assert.match(source, /input_service_consent: filters\.serviceConsentFilter/);
  assert.match(source, /input_privacy_consent: filters\.privacyConsentFilter/);
  assert.match(source, /input_marketing_consent: filters\.marketingConsentFilter/);
  assert.match(source, /input_announcement_enabled: filters\.announcementEnabledFilter/);
  assert.match(source, /input_mm_enabled: filters\.mmEnabledFilter/);
  assert.doesNotMatch(source, /\.select\("member_id"\)/);
  assert.doesNotMatch(source, /toInList|mergeMemberIdFilters/);
});

test("회원 목록 URL 필터는 알려진 값만 수용하고 검색 입력을 제한한다", () => {
  const filters = parseAdminMemberListFilters({
    q: `  ${"가".repeat(120)}  `,
    sort: "name",
    status: "mustChangePassword",
    mmLifecycle: "graduated",
    year: "15",
    campus: "서울",
    serviceConsent: "agreed",
    pushEnabled: "disabled",
    marketingEnabled: "enabled",
  });

  assert.equal(filters.searchValue, "가".repeat(80));
  assert.equal(filters.sortValue, "name");
  assert.equal(filters.filterValue, "mustChangePassword");
  assert.equal(filters.mattermostLifecycleFilter, "graduated");
  assert.equal(filters.yearFilter, "15");
  assert.equal(filters.campusFilter, "서울");
  assert.equal(filters.serviceConsentFilter, "agreed");
  assert.equal(filters.pushEnabledFilter, "disabled");
  assert.equal(filters.marketingEnabledFilter, "enabled");
  assert.equal(parseAdminMemberPage("999999"), 10_000);
  assert.equal(parseAdminMemberPage("not-a-page"), 1);
});
