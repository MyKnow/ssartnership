import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("로그인과 비밀번호 재설정은 정규화된 회원·MM 디렉터리 관계만 사용한다", () => {
  const memberAuthentication = readRepoFile("src/lib/member-authentication.ts");
  const resetIdentity = readRepoFile(
    "src/app/api/mm/_shared/reset-password-identity.ts",
  );
  const ssafyResetRoute = readRepoFile(
    "src/app/api/ssafy/reset-password/route.ts",
  );
  const resetComplete = readRepoFile(
    "src/app/api/mm/_shared/reset-password-complete.ts",
  );

  assert.match(memberAuthentication, /mattermost_account_id/);
  assert.doesNotMatch(
    memberAuthentication,
    /findActiveMemberByLegacyMattermostUserId|member_auth_identities|\.eq\("mm_user_id"/,
  );

  assert.match(resetIdentity, /\.eq\("mattermost_account_id", directoryEntry\.id\)/);
  assert.doesNotMatch(resetIdentity, /@\/lib\/mm-member-sync|\.eq\("mm_user_id"/);

  assert.match(ssafyResetRoute, /memberResult\.member\.mattermost_account_id/);
  assert.match(ssafyResetRoute, /\.from\("mm_user_directory"\)/);
  assert.match(
    ssafyResetRoute,
    /memberUpdatedAt: memberResult\.member\.updated_at/,
  );
  assert.doesNotMatch(
    ssafyResetRoute,
    /memberResult\.member\.mm_user_id|memberResult\.member\.mm_username/,
  );

  assert.match(
    resetComplete,
    /\.from\("mm_user_directory"\)[\s\S]{0,400}\.eq\("mm_user_id", tokenPayload\.mmUserId\)/,
  );
  assert.match(
    resetComplete,
    /\.eq\("mattermost_account_id", directoryEntry\.id\)/,
  );
  assert.doesNotMatch(
    resetComplete,
    /\.from\("members"\)[\s\S]{0,500}\.eq\("mm_user_id"/,
  );
});

test("관리자 권한은 admin_profiles와 MM 디렉터리만 기준으로 관리한다", () => {
  const adminAccounts = readRepoFile("src/lib/admin-accounts.ts");

  assert.match(adminAccounts, /\.from\("admin_profiles"\)/);
  assert.match(adminAccounts, /\.from\("mm_user_directory"\)/);
  assert.match(
    adminAccounts,
    /\.eq\("mattermost_account_id", directory\.id\)/,
  );
  assert.doesNotMatch(
    adminAccounts,
    /mapLegacyAdminMember|admin_permission_id|admin_managed_campus_slugs|Dual-write/,
  );
  assert.doesNotMatch(
    adminAccounts,
    /\.from\("members"\)[\s\S]{0,500}\.eq\("mm_username"/,
  );
});

test("정책 동의는 회원 mirror 대신 consent ledger를 기준으로 판정한다", () => {
  const policyDocuments = readRepoFile("src/lib/policy-documents.ts");
  const userAuth = readRepoFile("src/lib/user-auth.ts");
  const notificationPreferences = readRepoFile(
    "src/lib/notification-preferences.ts",
  );

  assert.match(policyDocuments, /\.from\("member_policy_consents"\)/);
  assert.match(policyDocuments, /getMemberPolicyConsentVersions/);
  assert.doesNotMatch(
    policyDocuments,
    /service_policy_version|privacy_policy_version|marketing_policy_version/,
  );
  assert.doesNotMatch(
    userAuth,
    /service_policy_version|privacy_policy_version/,
  );
  assert.match(notificationPreferences, /getMemberPolicyConsentVersions/);
  assert.doesNotMatch(
    notificationPreferences,
    /\.from\("members"\)[\s\S]{0,400}marketing_policy_version/,
  );
});

test("마케팅 수신 상태는 contract 전에 push preference로 보존한다", () => {
  const migration = readRepoFile(
    "supabase/migrations/20260713181223_backfill_member_marketing_preferences.sql",
  );

  assert.match(migration, /insert into public\.push_preferences/);
  assert.match(
    migration,
    /coalesce\(member\.marketing_policy_version = active_marketing_policy\.version, false\)/,
  );
  assert.match(migration, /on conflict \(member_id\) do update/);
});

test("명시적 Mattermost 프로필 동기화는 디렉터리 FK와 이미지 ledger만 갱신한다", () => {
  const profileSync = readRepoFile(
    "src/lib/member-mattermost-profile-sync.ts",
  );

  assert.match(profileSync, /mattermost_account_id/);
  assert.match(profileSync, /\.from\("member_profile_images"\)/);
  assert.doesNotMatch(
    profileSync,
    /member\.year|member\.mm_user_id|member\.mm_username|Compatibility fields/,
  );
});
