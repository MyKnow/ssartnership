import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("MM 중단은 기존 MM 연결을 보존하고 Mattermost 세션만 차단한다", async () => {
  const [authentication, transitionService, resetComplete, schema] = await Promise.all([
    read("src/lib/member-authentication.ts"),
    read("src/lib/member-email-login-transition.ts"),
    read("src/app/api/mm/_shared/reset-password-complete.ts"),
    read("supabase/schema.sql"),
  ]);

  assert.match(authentication, /\.is\("mattermost_login_disabled_at", null\)/);
  assert.match(authentication, /resolveMemberByVerifiedEmail/);
  assert.match(transitionService, /mattermost_account_id/);
  assert.doesNotMatch(transitionService, /mattermost_account_id:\s*null/);
  assert.match(resetComplete, /mattermost_login_disabled_at/);
  assert.match(schema, /member_email_login_transitions/);
});

test("직접 Mattermost 인증 가입은 수료 처리된 기수를 회원 생성 전에 차단한다", async () => {
  const [transitionService, signupRoute] = await Promise.all([
    read("src/lib/member-email-login-transition.ts"),
    read("src/app/api/mm/signup/route.ts"),
  ]);

  const guardIndex = signupRoute.indexOf("isMattermostLoginDisabledForGeneration");
  const insertIndex = signupRoute.indexOf('.from("members")\n      .insert(');
  assert.match(transitionService, /isMattermostLoginDisabledForGeneration/);
  assert.ok(guardIndex >= 0);
  assert.ok(insertIndex > guardIndex);
  assert.match(signupRoute, /errorResponse\("generation_completed", 409/);
  assert.match(signupRoute, /clearMattermostCodeSession/);
});

test("Mattermost 비밀번호 변경은 직접 Mattermost 세션으로만 처리한다", async () => {
  const [userAuth, changePassword] = await Promise.all([
    read("src/lib/user-auth.ts"),
    read("src/app/api/mm/change-password/route.ts"),
  ]);

  assert.match(userAuth, /authenticationMethod === "mattermost"/);
  assert.doesNotMatch(userAuth, /"ssafy"/);
  assert.match(changePassword, /session\.authenticationMethod === "mattermost"/);
  assert.doesNotMatch(changePassword, /"ssafy"/);
});
