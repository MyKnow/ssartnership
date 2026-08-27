import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("Mattermost 비활성 회원은 로컬 비밀번호 세션으로 로그인하고 이메일 게이트 상태를 받는다", async () => {
  const [authentication, loginRoute, legacyLoginRoute, userAuth, loginForm] =
    await Promise.all([
      read("src/lib/member-authentication.ts"),
      read("src/app/api/auth/login/route.ts"),
      read("src/app/api/mm/login/route.ts"),
      read("src/lib/user-auth.ts"),
      read("src/components/auth/LoginForm.tsx"),
    ]);

  assert.match(authentication, /resolveRecoverableMemberByMattermostUsername/);
  assert.match(
    authentication,
    /disabledMattermostMember\?\.mattermost_login_disabled_at[\s\S]+authenticationMethod: "manual"/,
  );
  assert.match(
    authentication,
    /disabledMember\?\.mattermost_login_disabled_at[\s\S]+authenticationMethod: "manual"/,
  );

  for (const source of [loginRoute, legacyLoginRoute]) {
    assert.match(source, /requiresMemberEmailRegistration/);
    assert.match(source, /requiresEmailRegistration/);
  }
  assert.match(legacyLoginRoute, /authenticationMethod: resolvedLogin\.authenticationMethod/);
  assert.match(
    userAuth,
    /email_verified_at,mattermost_login_disabled_at/,
  );
  assert.match(userAuth, /requiresMemberEmailRegistration/);
  assert.match(
    loginForm,
    /requiresEmailRegistration:\s*Boolean\([^)]*requiresEmailRegistration\)/,
  );
});

test("이메일 필수 화면은 완료 목적지를 정규화하고 필수 상태에서 이탈 링크를 숨긴다", async () => {
  const [page, pageHeader, resetTabs] = await Promise.all([
    read("src/app/(site)/certification/email/page.tsx"),
    read("src/components/certification/MemberEmailVerificationPageHeader.tsx"),
    read("src/components/auth/PasswordResetMethodTabs.tsx"),
  ]);

  assert.match(page, /getMemberGateCompletionReturnTo/);
  assert.match(page, /"email-registration"/);
  assert.match(page, /emailRegistrationRequired=\{emailRegistrationRequired\}/);
  assert.match(pageHeader, /emailRegistrationRequired\s*\?\s*\{\}/);
  assert.match(pageHeader, /Mattermost를 사용할 수 없는 계정이에요/);

  assert.doesNotMatch(
    resetTabs,
    /href="\/auth\/login\?returnTo=%2Fcertification%2Femail"/,
  );
  assert.doesNotMatch(resetTabs, /로그인 후 이메일 등록/);
  assert.doesNotMatch(resetTabs, /href="\/auth\/recover-email"/);
});
