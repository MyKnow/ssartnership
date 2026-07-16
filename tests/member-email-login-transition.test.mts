import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

const transitionModulePromise = import(
  new URL("../src/lib/member-mattermost-auth.ts", import.meta.url).href
);

test("MM 미사용 전환 사유는 기수 수료·중도 이탈·양쪽 조회 미발견만 허용한다", async () => {
  const {
    MATTERMOST_LOGIN_DISABLED_REASONS,
    isMattermostLoginDisabledReason,
  } = await transitionModulePromise;

  assert.deepEqual(MATTERMOST_LOGIN_DISABLED_REASONS, [
    "generation_completed",
    "member_departed",
    "provider_not_found",
  ]);
  assert.equal(isMattermostLoginDisabledReason("generation_completed"), true);
  assert.equal(isMattermostLoginDisabledReason("member_departed"), true);
  assert.equal(isMattermostLoginDisabledReason("provider_not_found"), true);
  assert.equal(isMattermostLoginDisabledReason("temporary_provider_failure"), false);
});

test("MM 로그인만 차단하고 이메일 로그인·기존 MM 식별자는 보존한다", async () => {
  const [
    authentication,
    transitionService,
    resetIdentity,
    resetCompletion,
    ssafyReset,
    schema,
  ] = await Promise.all([
    read("src/lib/member-authentication.ts"),
    read("src/lib/member-email-login-transition.ts"),
    read("src/app/api/mm/_shared/reset-password-identity.ts"),
    read("src/app/api/mm/_shared/reset-password-complete.ts"),
    read("src/app/api/ssafy/reset-password/route.ts"),
    read("supabase/schema.sql"),
  ]);

  assert.match(authentication, /\.is\("mattermost_login_disabled_at", null\)/);
  assert.match(authentication, /resolveMemberByVerifiedEmail/);
  assert.match(transitionService, /mattermost_account_id/);
  assert.doesNotMatch(transitionService, /mattermost_account_id:\s*null/);
  assert.match(resetIdentity, /mattermost_login_disabled_at/);
  assert.match(resetCompletion, /mattermost_login_disabled_at/);
  assert.match(ssafyReset, /mattermost_login_disabled_at/);
  assert.match(schema, /mattermost_login_disabled_at/);
  assert.match(schema, /member_email_login_transitions/);
});

test("MM 중단 회원은 SSAFY Verify·MM 비밀번호 로그인으로 새 세션을 만들 수 없다", async () => {
  const [verifyToken, userAuth, passwordLogin, mmLogin, changePassword] = await Promise.all([
    read("src/app/api/ssafy/verify-token/route.ts"),
    read("src/lib/user-auth.ts"),
    read("src/app/api/auth/login/route.ts"),
    read("src/app/api/mm/login/route.ts"),
    read("src/app/api/mm/change-password/route.ts"),
  ]);

  assert.match(verifyToken, /mattermost_login_disabled_at/);
  assert.match(verifyToken, /authenticationMethod:\s*"ssafy"/);
  assert.match(userAuth, /mattermost_login_disabled_at/);
  assert.match(userAuth, /authenticationMethod === "mattermost"/);
  assert.match(userAuth, /authenticationMethod === "ssafy"/);
  assert.match(passwordLogin, /freshAuthentication:\s*true/);
  assert.match(mmLogin, /authenticationMethod:\s*"mattermost"/);
  assert.match(changePassword, /freshAuthentication:\s*true/);
  assert.doesNotMatch(changePassword, /authenticationMethod:\s*"mattermost"/);
});

test("MM 중단은 기존 MM 전달 비밀번호 설정 링크도 폐기하고 완료 시점에 다시 막는다", async () => {
  const [migration, completionService, completionRoute] = await Promise.all([
    read("supabase/migrations/20260714234606_add_member_email_login_transition.sql"),
    read("src/lib/member-manual-import/service.server.ts"),
    read("src/app/api/member-password-action/complete/route.ts"),
  ]);
  const disableMemberDefinition = migration.slice(
    migration.indexOf("create or replace function public.disable_member_mattermost_login"),
    migration.indexOf("create table if not exists public.member_mattermost_disabled_generations"),
  );
  const disableGenerationDefinition = migration.slice(
    migration.indexOf("create or replace function public.disable_generation_mattermost_logins"),
    migration.indexOf("create or replace function public.begin_member_email_login_transition"),
  );
  const completeDefinition = migration.slice(
    migration.indexOf("create or replace function public.complete_member_password_action"),
    migration.indexOf("create or replace function public.complete_manual_member_password_action"),
  );

  for (const definition of [disableMemberDefinition, disableGenerationDefinition]) {
    assert.match(definition, /update public\.member_password_action_tokens/);
    assert.match(definition, /delivery_channel = 'mattermost'/);
  }
  assert.match(completeDefinition, /member_row\.mattermost_login_disabled_at is not null/);
  assert.match(completeDefinition, /token_row\.delivery_channel = 'mattermost'/);
  assert.match(migration, /complete_member_password_action_with_delivery/);
  assert.match(completionService, /complete_member_password_action_with_delivery/);
  assert.match(completionRoute, /deliveryChannel === "mattermost" \? "mattermost" : "email"/);
});

test("MM 비밀번호 변경·재설정은 같은 DB 잠금 안에서 MM 활성 상태와 토큰 버전을 재검사한다", async () => {
  const [migration, changePassword, resetComplete] = await Promise.all([
    read("supabase/migrations/20260714234606_add_member_email_login_transition.sql"),
    read("src/app/api/mm/change-password/route.ts"),
    read("src/app/api/mm/_shared/reset-password-complete.ts"),
  ]);

  assert.match(migration, /update_member_mattermost_password_credentials/);
  assert.match(migration, /member_row\.mattermost_login_disabled_at is not null/);
  assert.match(migration, /member_row\.updated_at is distinct from p_expected_updated_at/);
  assert.match(changePassword, /session\.authenticationMethod === "mattermost"/);
  assert.match(changePassword, /update_member_mattermost_password_credentials/);
  assert.match(resetComplete, /update_member_mattermost_password_credentials/);
});

test("manual- 식별자가 MM username으로 fallback되면 MM 인증으로 세션을 발급한다", async () => {
  const [authentication, passwordLogin] = await Promise.all([
    read("src/lib/member-authentication.ts"),
    read("src/app/api/auth/login/route.ts"),
  ]);

  assert.match(authentication, /export type LoginMemberResolution/);
  assert.match(authentication, /authenticationMethod: "manual"/);
  assert.match(authentication, /authenticationMethod: "mattermost"/);
  assert.match(authentication, /resolveActiveMemberForLoginWithSource/);
  assert.match(passwordLogin, /resolveActiveMemberForLoginWithSource/);
  assert.match(passwordLogin, /authenticationMethod:\s*resolvedLogin\.authenticationMethod/);
});

test("이메일 전환은 해시 토큰·원자적 완료·세션 버전 증가를 사용한다", async () => {
  const [transitionService, userAuth, schema] = await Promise.all([
    read("src/lib/member-email-login-transition.ts"),
    read("src/lib/user-auth.ts"),
    read("supabase/schema.sql"),
  ]);

  assert.match(transitionService, /generateOpaqueToken/);
  assert.match(transitionService, /hashOpaqueToken/);
  assert.match(transitionService, /begin_member_email_login_transition/);
  assert.match(schema, /complete_member_password_action/);
  assert.match(schema, /auth_session_version/);
  const finalPasswordActionDefinition = schema.slice(
    schema.lastIndexOf("create or replace function public.complete_member_password_action(\n"),
  );
  assert.match(finalPasswordActionDefinition, /candidate_email_reservation_hash/);
  assert.match(userAuth, /authSessionVersion/);
  assert.match(userAuth, /auth_session_version/);
});

test("기수 수료 처리는 외부 API 반복 없이 한 번의 DB 일괄 갱신으로 MM 로그인만 중단한다", async () => {
  const [transitionService, migration] = await Promise.all([
    read("src/lib/member-email-login-transition.ts"),
    read("supabase/migrations/20260714234606_add_member_email_login_transition.sql"),
  ]);

  assert.match(transitionService, /disable_generation_mattermost_logins/);
  assert.match(migration, /update public\.members/);
  assert.match(migration, /where generation = p_generation/);
  assert.match(migration, /mattermost_account_id is not null/);
  assert.doesNotMatch(migration, /mattermost_account_id\s*=\s*null/);
  assert.match(migration, /member_mattermost_disabled_generations/);
  assert.match(migration, /enforce_completed_generation_mattermost_login_block/);
  assert.match(migration, /before insert or update of generation, mattermost_account_id/);
  assert.match(migration, /pg_advisory_xact_lock\(741515, new\.generation\)/);
  assert.match(migration, /pg_advisory_xact_lock\(741515, p_generation\)/);
});

test("수료 처리된 기수의 신규 SSAFY 가입은 레코드 생성 전·동시 수료 시점 모두 차단한다", async () => {
  const [transitionService, signupRoute] = await Promise.all([
    read("src/lib/member-email-login-transition.ts"),
    read("src/app/api/ssafy/signup/route.ts"),
  ]);

  const completedGenerationGuardIndex = signupRoute.indexOf(
    "if (await isMattermostLoginDisabledForGeneration(signupGeneration))",
  );
  const memberInsertIndex = signupRoute.indexOf('.from("members")\n      .insert(payload)');

  assert.match(transitionService, /isMattermostLoginDisabledForGeneration/);
  assert.ok(completedGenerationGuardIndex >= 0);
  assert.ok(memberInsertIndex > completedGenerationGuardIndex);
  assert.match(signupRoute, /errorResponse\("generation_completed", 409/);
  assert.match(signupRoute, /await clearSsafySignupSession\(\)/);
  assert.match(signupRoute, /UserSessionIssueError/);
  assert.match(
    signupRoute,
    /error instanceof UserSessionIssueError && error\.code === "mattermost_login_disabled"/,
  );
  const sessionIssueIndex = signupRoute.indexOf("error instanceof UserSessionIssueError");
  const sessionIssueSection = signupRoute.slice(sessionIssueIndex);
  assert.match(
    sessionIssueSection,
    /\.from\("members"\)[\s\S]*?\.delete\(\)[\s\S]*?\.eq\("id", insertedMember\.id\)/,
  );
});

test("이메일 전환은 탈퇴·대기·완료 전환의 이메일 식별자를 재사용하지 않는다", async () => {
  const [transitionService, migration, schema] = await Promise.all([
    read("src/lib/member-email-login-transition.ts"),
    read("supabase/migrations/20260714234606_add_member_email_login_transition.sql"),
    read("supabase/schema.sql"),
  ]);

  assert.match(transitionService, /buildReservedMemberIdentifierHashes/);
  assert.match(transitionService, /p_email_reservation_hash/);
  assert.match(migration, /member_identifier_reservations/);
  assert.match(migration, /member_email_login_transition_email_reserved/);
  assert.match(migration, /candidate_email_reservation_hash/);
  for (const source of [migration, schema]) {
    const uniqueIndexStart = source.indexOf(
      "create unique index if not exists member_email_login_transitions_email_unique",
    );
    const uniqueIndexDefinition = source.slice(
      uniqueIndexStart,
      source.indexOf("alter table public.member_email_login_transitions", uniqueIndexStart),
    );

    assert.ok(uniqueIndexStart >= 0);
    assert.match(uniqueIndexDefinition, /candidate_email_normalized/);
    assert.match(uniqueIndexDefinition, /where status <> 'cancelled'/);
  }
  assert.match(
    transitionService,
    /member_email_login_transitions_email_unique/,
  );

  const finalPasswordActionDefinition = migration.slice(
    migration.lastIndexOf("create or replace function public.complete_member_password_action(\n"),
  );
  assert.match(finalPasswordActionDefinition, /candidate_email_reservation_hash/);
});

test("회원 수정 권한이 없는 상세 화면에는 전환 후보 이메일을 조회·직렬화하지 않는다", async () => {
  const [page, view, accountManager] = await Promise.all([
    read("src/app/admin/(protected)/members/[memberId]/page.tsx"),
    read("src/components/admin/AdminMemberDetailView.tsx"),
    read("src/components/admin/member-detail/AdminMemberAccountManager.tsx"),
  ]);

  assert.match(page, /const canUpdateMembers = canAdmin\(/);
  assert.match(
    page,
    /canUpdateMembers\s*\?\s*getMemberEmailLoginTransition\(memberId\)\s*:\s*Promise\.resolve\(null\)/,
  );
  assert.match(
    page,
    /\.\.\.\(canUpdateMembers\s*\?\s*\{[\s\S]*?email: member\.email,[\s\S]*?emailLoginTransition,[\s\S]*?\}\s*:\s*\{\}\)/,
  );
  assert.match(
    view,
    /\.\.\.\(canUpdate\s*\?\s*\{[\s\S]*?email: member\.email,[\s\S]*?emailLoginTransition: member\.emailLoginTransition,[\s\S]*?\}\s*:\s*\{\}\)/,
  );
  assert.match(accountManager, /email\?: string \| null;/);
  assert.match(accountManager, /emailLoginTransition\?: MemberEmailLoginTransition \| null;/);
});

test("기수 수료 일괄 차단은 trigger와 반대 잠금 순서가 되지 않게 members 쓰기를 먼저 직렬화한다", async () => {
  const [migration, schema] = await Promise.all([
    read("supabase/migrations/20260714234606_add_member_email_login_transition.sql"),
    read("supabase/schema.sql"),
  ]);

  for (const source of [migration, schema]) {
    const generationDisableStart = source.indexOf(
      "create or replace function public.disable_generation_mattermost_logins",
    );
    const generationDisableDefinition = source.slice(generationDisableStart);
    const membersLockIndex = generationDisableDefinition.indexOf(
      "lock table public.members in exclusive mode;",
    );
    const advisoryLockIndex = generationDisableDefinition.indexOf(
      "perform pg_advisory_xact_lock(741515, p_generation);",
    );

    assert.ok(membersLockIndex >= 0);
    assert.ok(advisoryLockIndex > membersLockIndex);
  }
});

test("스키마 스냅샷의 최종 비밀번호 토큰 계약은 이메일 전환과 수동 재발급 잠금 순서를 보존한다", async () => {
  const schema = await read("supabase/schema.sql");
  const finalPurposeConstraint = schema.slice(
    schema.lastIndexOf("drop constraint if exists member_password_action_tokens_purpose_check"),
  );
  const finalManualCompletion = schema.slice(
    schema.lastIndexOf("create or replace function public.complete_manual_member_password_action"),
  );

  assert.match(finalPurposeConstraint, /member_email_login_transition/);
  assert.match(finalManualCompletion, /candidate_member_id uuid/);
  assert.match(finalManualCompletion, /the member first, then the token/);
  assert.doesNotMatch(finalManualCompletion, /return public\.complete_member_password_action/);
  assert.match(schema, /complete_member_password_action_with_delivery/);
  assert.match(schema, /update_member_mattermost_password_credentials/);
  assert.match(schema, /lock table public\.members in exclusive mode;/);
});

test("전환 재발급과 비밀번호 설정은 member 행을 먼저 잠가 token 교착을 피한다", async () => {
  const migration = await read(
    "supabase/migrations/20260714234606_add_member_email_login_transition.sql",
  );

  assert.match(migration, /Lock the member first, matching begin_member_email_login_transition/);
  assert.match(migration, /Keep the same member-first lock order as every transition action/);
  assert.match(migration, /token_id := token_row\.id;/);
  assert.match(migration, /select \* into member_row[\s\S]*for update;/);
});

test("프로필 백필은 MM User ID와 lifecycle 판정만 사용하고 username fallback을 수행하지 않는다", async () => {
  const [memberDomain, profileSync, snapshot, sync] = await Promise.all([
    read("src/lib/member-domain.ts"),
    read("src/lib/member-mattermost-profile-sync.ts"),
    read("src/lib/mm-member-sync/snapshot.ts"),
    read("src/lib/mm-member-sync/sync.ts"),
  ]);

  assert.doesNotMatch(memberDomain, /memberPatch\.campus/);
  assert.doesNotMatch(profileSync, /fetchMemberSnapshotByUsername/);
  assert.match(profileSync, /fetchMemberLifecycleByUserId/);
  assert.match(profileSync, /resolveMattermostLifecycle/);
  assert.match(profileSync, /markMemberMattermostLoginUnavailable/);
  assert.match(profileSync, /fetchMemberSnapshotByUserId/);
  assert.doesNotMatch(snapshot, /fetchMemberSnapshotByUsername/);
  assert.doesNotMatch(snapshot, /member_profile_sync_username_fallback/);
  assert.match(snapshot, /MATTERMOST_PROFILE_NOT_FOUND/);
  assert.doesNotMatch(snapshot, /if \(!payload\) \{\s*return null;/);
  assert.match(sync, /fetchBatchStates/);
  assert.match(sync, /parseMattermostLifecycleBatch/);
  assert.match(sync, /\.is\("mattermost_login_disabled_at", null\)/);
});
