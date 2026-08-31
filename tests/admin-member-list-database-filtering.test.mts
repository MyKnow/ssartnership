import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260831111653_filter_admin_member_list_in_database.sql",
  import.meta.url,
);
const schemaPath = new URL("../supabase/schema.sql", import.meta.url);
const readModelPath = new URL(
  "../src/lib/admin-member-list.server.ts",
  import.meta.url,
);

test("관리자 회원 목록은 필터 교집합·count·추이·페이지 ID를 DB에서 함께 계산한다", async () => {
  const [migration, readModel] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(readModelPath, "utf8"),
  ]);

  assert.match(migration, /create or replace function public\.get_admin_member_list_page/);
  assert.match(migration, /with filtered_members as materialized/);
  assert.match(migration, /left join public\.push_preferences as preferences/);
  assert.match(migration, /left join public\.member_policy_consents as service_consent/);
  assert.match(migration, /left join public\.member_policy_consents as privacy_consent/);
  assert.match(migration, /left join public\.member_policy_consents as marketing_consent/);
  assert.match(migration, /array\([\s\S]*select page_member\.id[\s\S]*as member_ids/);
  assert.match(migration, /select pg_catalog\.count\(\*\)::bigint[\s\S]*as total_count/);
  assert.match(migration, /select trend_member\.created_at[\s\S]*as trend_created_ats/);
  assert.match(migration, /offset greatest\(coalesce\(input_offset, 0\), 0\)/);
  assert.match(migration, /greatest\(coalesce\(input_page_size, 20\), 1\)/);
  assert.match(migration, /greatest\(coalesce\(input_trend_limit, 5000\), 1\)/);

  assert.match(readModel, /rpc\("get_admin_member_list_page"/);
  assert.match(readModel, /input_offset: from/);
  assert.match(readModel, /input_page_size: pageSize/);
  assert.match(readModel, /input_trend_limit: ADMIN_MEMBER_TREND_SAMPLE_LIMIT/);
  assert.match(readModel, /\.select\(ADMIN_MEMBER_LIST_SELECT\)[\s\S]*\.in\("id", memberIds\)/);
  assert.match(readModel, /orderAdminMemberRowsByPage/);
  assert.doesNotMatch(readModel, /getPreferenceFilteredMemberIds/);
  assert.doesNotMatch(readModel, /getPolicyConsentFilteredMemberIds/);
  assert.doesNotMatch(readModel, /getMemberSearchIds/);
  assert.doesNotMatch(readModel, /\.not\("id", "in"/);
});

test("설정 행이 없는 회원은 알림 종류별 기존 기본값으로 필터링된다", async () => {
  const migration = await readFile(migrationPath, "utf8");

  for (const column of ["enabled", "marketing_enabled"]) {
    assert.match(
      migration,
      new RegExp(`coalesce\\(preferences\\.${column}, false\\)`),
    );
  }
  for (const column of [
    "announcement_enabled",
    "new_partner_enabled",
    "expiring_partner_enabled",
    "review_enabled",
    "mm_enabled",
  ]) {
    assert.match(
      migration,
      new RegExp(`coalesce\\(preferences\\.${column}, true\\)`),
    );
  }

  assert.match(
    migration,
    /case input_push_enabled[\s\S]*when 'enabled'[\s\S]*when 'disabled'/,
  );
  assert.match(
    migration,
    /case input_announcement_enabled[\s\S]*when 'enabled'[\s\S]*when 'disabled'/,
  );
});

test("현재 정책 동의와 마케팅 opt-in 계약을 SQL 필터가 유지한다", async () => {
  const [migration, readModel] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(readModelPath, "utf8"),
  ]);

  assert.match(
    migration,
    /service_consent\.policy_document_id = input_service_policy_id/,
  );
  assert.match(
    migration,
    /privacy_consent\.policy_document_id = input_privacy_policy_id/,
  );
  assert.match(
    migration,
    /marketing_consent\.policy_document_id = input_marketing_policy_id/,
  );
  assert.match(
    migration,
    /input_marketing_policy_id is null[\s\S]*or case input_marketing_consent[\s\S]*when 'agreed' then[\s\S]*marketing_consent\.member_id is not null[\s\S]*and coalesce\(preferences\.marketing_enabled, false\)[\s\S]*when 'pending' then not/,
  );
  assert.match(readModel, /input_service_policy_id: activePolicies\?\.service\.id \?\? null/);
  assert.match(readModel, /input_privacy_policy_id: activePolicies\?\.privacy\.id \?\? null/);
  assert.match(readModel, /input_marketing_policy_id: activeMarketingPolicy\?\.id \?\? null/);
  assert.match(readModel, /hasPolicyConsentFilter && !activePolicies/);
});

test("검색·회원 상태·MM 생명주기·정렬 계약과 service-role 전용 경계를 유지한다", async () => {
  const [migration, schema] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(schemaPath, "utf8"),
  ]);

  for (const searchableColumn of [
    "members.display_name",
    "members.manual_login_id",
    "members.email_normalized",
    "directory.mm_username",
    "directory.mm_user_id",
  ]) {
    assert.match(
      migration,
      new RegExp(`${searchableColumn.replace(".", "\\.")} ilike input_search_pattern`),
    );
  }
  assert.match(migration, /members\.generation = input_generation/);
  assert.match(migration, /members\.campus = input_campus/);
  assert.match(migration, /case input_password_status/);
  assert.match(migration, /case input_mattermost_lifecycle/);
  assert.match(migration, /members\.mattermost_login_disabled_at is not null/);
  assert.match(migration, /members\.mattermost_login_disabled_reason = 'generation_completed'/);
  assert.match(migration, /members\.mattermost_login_disabled_reason = 'member_departed'/);
  assert.match(migration, /case when input_sort = 'name' then page_member\.display_name/);
  assert.match(migration, /case when input_sort = 'updated' then page_member\.updated_at/);
  assert.match(migration, /then page_member\.created_at/);
  assert.match(migration, /security invoker/);
  assert.match(
    migration,
    /revoke all on function public\.get_admin_member_list_page\([\s\S]*from authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_admin_member_list_page\([\s\S]*to service_role;/,
  );
  assert.ok(schema.includes(migration.trim()));
});
