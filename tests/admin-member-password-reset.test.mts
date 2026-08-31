import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

function getFunctionSql(source: string, functionName: string) {
  const start = source.lastIndexOf(
    `create or replace function public.${functionName}(`,
  );
  assert.notEqual(start, -1, `${functionName} must exist`);
  const end = source.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `${functionName} must terminate`);
  return source.slice(start, end + 4);
}

test("관리자 회원 비밀번호 재발급은 권한·동일 출처·무캐시 응답을 강제한다", async () => {
  const [route, service, panel, catalog, logLabels] = await Promise.all([
    read("src/app/api/admin/members/[id]/password-reset/route.ts"),
    read("src/lib/admin-member-password-reset.ts"),
    read("src/components/admin/member-detail/AdminMemberPasswordResetPanel.tsx"),
    read("src/lib/event-catalog.ts"),
    read("src/components/admin/logs/utils.ts"),
  ]);

  assert.match(route, /isTrustedSameOriginRequest/);
  assert.match(route, /getAdminApiPermissionSession\(request, "members", "update"\)/);
  assert.match(route, /isUuid\(memberId\)/);
  assert.match(route, /Cache-Control": "no-store, max-age=0"/);
  assert.match(route, /issueAdminMemberPasswordReset/);
  assert.match(route, /member_password_reset_link_generate/);
  assert.match(route, /member_password_reset_link_send/);
  assert.match(route, /actionKind: issued\.actionKind/);
  assert.doesNotMatch(route, /properties: \{[^}]*resetUrl/);
  assert.doesNotMatch(route, /properties: \{[^}]*token/);

  assert.match(service, /generateOpaqueToken/);
  assert.match(service, /hashOpaqueToken\(token\)/);
  assert.match(service, /must_change_password/);
  assert.match(service, /input\.mustChangePassword[\s\S]*"manual_initial_setup"[\s\S]*"admin_password_reset"/);
  assert.match(service, /"issue_admin_member_password_action"/);
  assert.match(service, /p_delivery_channel: input\.delivery === "email" \? "email" : "admin"/);
  assert.match(service, /p_expected_email: input\.delivery === "email" \? input\.email : null/);
  assert.match(service, /buildMemberPasswordSetupUrl\(token\)/);
  assert.match(service, /input\.delivery === "email" && !member\.email_normalized/);
  assert.match(service, /sendMemberInitialSetupReissueEmail/);
  assert.match(service, /sendMemberPasswordResetEmail/);
  assert.match(service, /admin_member_password_action_transition_pending/);
  assert.match(service, /email_transition_pending/);
  assert.match(panel, /const canSendEmail = Boolean\(email\)/);
  assert.match(panel, /mustChangePassword/);
  assert.match(panel, /초기 설정 링크 재발급/);
  assert.match(panel, /기존 설정·재설정 링크는 즉시 무효화됩니다/);
  assert.match(panel, /navigator\.clipboard\.writeText/);
  assert.match(panel, /setResetUrl\(null\)/);
  assert.match(panel, /발급된 \{actionLabel\} 링크/);
  assert.match(panel, /event\.currentTarget\.select\(\)/);
  assert.match(panel, /이메일로 발송/);
  assert.match(panel, /직접 전달한 링크로는 이메일 인증 상태가 바뀌지 않습니다/);
  assert.match(route, /등록된 이메일이 있는 회원에게만 이메일로 발송할 수 있습니다/);
  assert.match(route, /이메일 로그인 전환이 진행 중인 회원입니다/);
  assert.match(catalog, /member_password_reset_link_generate/);
  assert.match(catalog, /member_password_reset_link_send/);
  assert.match(logLabels, /member_password_reset_link_generate/);
  assert.match(logLabels, /member_password_reset_link_send/);
});

test("관리자 재발급은 한 개의 활성 링크만 유지하고 실제 이메일 전달만 이메일 인증을 완료한다", async () => {
  const [migration, schema, completionRoute, emailHelper] = await Promise.all([
    read("supabase/migrations/20260822205759_fix_admin_initial_setup_reissue.sql"),
    read("supabase/schema.sql"),
    read("src/app/api/member-password-action/complete/route.ts"),
    read("src/lib/member-password-action-email.ts"),
  ]);
  const legacyMigration = await read(
    "supabase/migrations/20260821001338_add_admin_member_password_reset.sql",
  );
  const schemaCompleteAction = getFunctionSql(schema, "complete_member_password_action");
  const schemaCompleteWithDelivery = getFunctionSql(
    schema,
    "complete_member_password_action_with_delivery",
  );
  const schemaFunction = getFunctionSql(schema, "issue_admin_member_password_action");

  assert.match(legacyMigration, /'admin_password_reset'/);
  assert.match(legacyMigration, /delivery_channel in \('mattermost', 'email', 'admin'\)/);
  assert.match(legacyMigration, /members_admin_email_normalized_trgm_idx/);
  assert.match(legacyMigration, /email_normalized extensions\.gin_trgm_ops/);
  assert.match(
    legacyMigration,
    /case token_row\.delivery_channel[\s\S]*when 'mattermost' then 'mattermost'[\s\S]*when 'email' then 'email'[\s\S]*else 'manual'/,
  );
  assert.match(
    legacyMigration,
    /when token_row\.delivery_channel = 'email' then coalesce\(email_verified_at, now\(\)\)/,
  );

  assert.match(schema, /'admin_password_reset'/);
  assert.match(schema, /delivery_channel in \('mattermost', 'email', 'admin'\)/);
  assert.match(schema, /members_admin_email_normalized_trgm_idx/);
  assert.match(schema, /email_normalized extensions\.gin_trgm_ops/);
  assert.match(schemaCompleteWithDelivery, /'authenticationMethod', authentication_method/);
  assert.match(
    schemaCompleteWithDelivery,
    /case token_row\.delivery_channel[\s\S]*when 'mattermost' then 'mattermost'[\s\S]*when 'email' then 'email'[\s\S]*else 'manual'/,
  );
  assert.match(
    schemaCompleteAction,
    /when token_row\.delivery_channel = 'email' then coalesce\(email_verified_at, now\(\)\)/,
  );
  for (const source of [migration, schemaFunction]) {
    assert.match(source, /issue_admin_member_password_action/);
    assert.match(source, /p_purpose in \('manual_initial_setup', 'admin_password_reset'\)/);
    assert.match(source, /p_delivery_channel in \('email', 'admin'\)/);
    assert.match(source, /member_row\.email_normalized is distinct from p_expected_email/);
    assert.match(
      source,
      /update public\.member_password_action_tokens[\s\S]*where member_id = member_row\.id[\s\S]*and consumed_at is null/,
    );
    assert.match(
      source,
      /if exists \([\s\S]*from public\.member_email_login_transitions[\s\S]*status in \('pending_delivery', 'email_sent'\)[\s\S]*admin_member_password_action_transition_pending/,
    );
    assert.doesNotMatch(source, /set status = 'cancelled'/);
  }
  assert.match(completionRoute, /authenticationMethod: completion\.authenticationMethod/);
  assert.match(emailHelper, /url\.hash = new URLSearchParams\(\{ token \}\)\.toString\(\)/);
  assert.match(emailHelper, /email\.manual_member_setup_reissue/);
  assert.doesNotMatch(emailHelper, /searchParams\.set\("token"/);
});

test("회원 목록과 상세는 이메일 식별과 검색을 함께 제공한다", async () => {
  const [
    readModel,
    selectors,
    listItem,
    detailView,
    detailPage,
    manager,
    memberListFilterMigration,
  ] = await Promise.all([
    read("src/lib/admin-member-list.server.ts"),
    read("src/components/admin/member-manager/selectors.ts"),
    read("src/components/admin/AdminMemberListItem.tsx"),
    read("src/components/admin/AdminMemberDetailView.tsx"),
    read("src/app/admin/(protected)/members/[memberId]/page.tsx"),
    read("src/components/admin/AdminMemberManager.tsx"),
    read(
      "supabase/migrations/20260831111653_filter_admin_member_list_in_database.sql",
    ),
  ]);

  assert.match(readModel, /email,email_normalized/);
  assert.match(readModel, /getAdminSearchLikePattern\(filters\.searchValue\)/);
  assert.match(
    memberListFilterMigration,
    /members\.email_normalized ilike input_search_pattern/,
  );
  assert.match(readModel, /email: member\.email \?\? member\.email_normalized/);
  assert.match(selectors, /member\.email \?\? ""/);
  assert.match(listItem, /member\.mmUsername[\s\S]*?member\.email/);
  assert.match(listItem, /이메일 · \$\{member\.email\}/);
  assert.match(detailView, /<span>이메일<\/span>/);
  assert.match(detailView, /\{member\.email \?\? "이메일 미등록"\}/);
  assert.match(detailPage, /email: member\.email,/);
  assert.match(manager, /이름, 이메일, 직접 로그인 ID, MM 아이디로 검색/);
});
