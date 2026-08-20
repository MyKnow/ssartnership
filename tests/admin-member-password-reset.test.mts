import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

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
  assert.match(route, /properties: \{ delivery \}/);
  assert.doesNotMatch(route, /properties: \{[^}]*resetUrl/);
  assert.doesNotMatch(route, /properties: \{[^}]*token/);

  assert.match(service, /generateOpaqueToken/);
  assert.match(service, /hashOpaqueToken\(token\)/);
  assert.match(service, /purpose: "admin_password_reset"/);
  assert.match(service, /\.in\("purpose", \["admin_password_reset", "manual_password_reset"\]\)/);
  assert.match(service, /delivery_channel: "admin"/);
  assert.match(service, /buildMemberPasswordSetupUrl\(token\)/);
  assert.match(service, /email_verified_at/);
  assert.match(service, /input\.delivery === "email"/);
  assert.match(service, /sendMemberPasswordResetEmail/);
  assert.match(panel, /기존에 사용하지 않은 재발급 링크는 즉시 무효화됩니다/);
  assert.match(panel, /navigator\.clipboard\.writeText/);
  assert.match(panel, /setResetUrl\(null\)/);
  assert.match(panel, /발급된 비밀번호 재발급 링크/);
  assert.match(panel, /event\.currentTarget\.select\(\)/);
  assert.match(panel, /이메일로 발송/);
  assert.match(catalog, /member_password_reset_link_generate/);
  assert.match(catalog, /member_password_reset_link_send/);
  assert.match(logLabels, /member_password_reset_link_generate/);
  assert.match(logLabels, /member_password_reset_link_send/);
});

test("관리자 재발급 토큰은 기존 회원 비밀번호 설정 흐름으로만 완료되고 이메일 인증을 우회하지 않는다", async () => {
  const [migration, schema, completionRoute, emailHelper] = await Promise.all([
    read("supabase/migrations/20260821001338_add_admin_member_password_reset.sql"),
    read("supabase/schema.sql"),
    read("src/app/api/member-password-action/complete/route.ts"),
    read("src/lib/member-password-action-email.ts"),
  ]);

  for (const source of [migration, schema]) {
    assert.match(source, /'admin_password_reset'/);
    assert.match(source, /delivery_channel in \('mattermost', 'email', 'admin'\)/);
    assert.match(source, /members_admin_email_normalized_trgm_idx/);
    assert.match(source, /email_normalized extensions\.gin_trgm_ops/);
    assert.match(source, /'authenticationMethod', authentication_method/);
    assert.match(
      source,
      /case token_row\.delivery_channel[\s\S]*when 'mattermost' then 'mattermost'[\s\S]*when 'email' then 'email'[\s\S]*else 'manual'/,
    );
    assert.match(source, /when token_row\.delivery_channel = 'email' then coalesce\(email_verified_at, now\(\)\)/);
  }
  assert.match(completionRoute, /authenticationMethod: completion\.authenticationMethod/);
  assert.match(emailHelper, /url\.hash = new URLSearchParams\(\{ token \}\)\.toString\(\)/);
  assert.doesNotMatch(emailHelper, /searchParams\.set\("token"/);
});

test("회원 목록과 상세는 이메일 식별과 검색을 함께 제공한다", async () => {
  const [readModel, selectors, listItem, detailView, detailPage, manager] = await Promise.all([
    read("src/lib/admin-member-list.server.ts"),
    read("src/components/admin/member-manager/selectors.ts"),
    read("src/components/admin/AdminMemberListItem.tsx"),
    read("src/components/admin/AdminMemberDetailView.tsx"),
    read("src/app/admin/(protected)/members/[memberId]/page.tsx"),
    read("src/components/admin/AdminMemberManager.tsx"),
  ]);

  assert.match(readModel, /email,email_normalized/);
  assert.match(readModel, /email_normalized\.ilike\.\$\{pattern\}/);
  assert.match(readModel, /\.ilike\("email_normalized", pattern\)/);
  assert.match(readModel, /email: member\.email \?\? member\.email_normalized/);
  assert.match(selectors, /member\.email \?\? ""/);
  assert.match(listItem, /member\.mmUsername[\s\S]*?member\.email/);
  assert.match(listItem, /이메일 · \$\{member\.email\}/);
  assert.match(detailView, /<span>이메일<\/span>/);
  assert.match(detailView, /\{member\.email \?\? "이메일 미등록"\}/);
  assert.match(detailPage, /email: member\.email,/);
  assert.match(manager, /이름, 이메일, 직접 로그인 ID, MM 아이디로 검색/);
});
