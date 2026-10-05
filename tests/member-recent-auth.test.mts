import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MEMBER_CURRENT_PASSWORD_MAX_LENGTH,
  MEMBER_RECENT_AUTH_ERRORS,
  MEMBER_RECENT_AUTH_WINDOW_MS,
  getMemberCurrentPasswordFieldError,
  getMemberRecentAuthFeedback,
  isMemberAuthenticationRecent,
  isMemberRecentAuthErrorCode,
  parseMemberCurrentPasswordInput,
  resolveMemberRecentAuthRequirement,
} from "../src/lib/member-recent-auth.ts";
import { parseUserSessionToken } from "../src/lib/session-tokens.ts";
import { createHmac, randomBytes } from "node:crypto";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("최근 인증은 10분 창 안의 자격 확인 시각만 인정한다", () => {
  const now = Date.UTC(2026, 9, 5, 12);
  assert.equal(MEMBER_RECENT_AUTH_WINDOW_MS, 10 * 60 * 1000);
  assert.equal(isMemberAuthenticationRecent(now - MEMBER_RECENT_AUTH_WINDOW_MS, now), true);
  assert.equal(isMemberAuthenticationRecent(now - MEMBER_RECENT_AUTH_WINDOW_MS - 1, now), false);
  assert.equal(isMemberAuthenticationRecent(now + 1, now), false);
  assert.equal(isMemberAuthenticationRecent(undefined, now), false);
  assert.equal(isMemberAuthenticationRecent(Number.NaN, now), false);

  assert.equal(resolveMemberRecentAuthRequirement({ authenticatedAt: now - 1_000, hasPassword: false, now }), "none");
  assert.equal(resolveMemberRecentAuthRequirement({ authenticatedAt: undefined, hasPassword: true, now }), "password");
  assert.equal(resolveMemberRecentAuthRequirement({ authenticatedAt: undefined, hasPassword: false, now }), "reauthentication");
});

test("현재 비밀번호 입력은 FE·BE가 같은 규칙으로 정규화·검증한다", () => {
  assert.deepEqual(parseMemberCurrentPasswordInput(undefined), { ok: true, currentPassword: null });
  assert.deepEqual(parseMemberCurrentPasswordInput("   "), { ok: true, currentPassword: null });
  assert.deepEqual(parseMemberCurrentPasswordInput(" pass word "), { ok: true, currentPassword: "pass word" });
  assert.deepEqual(parseMemberCurrentPasswordInput(123), { ok: false, code: "current_password_invalid" });
  assert.deepEqual(
    parseMemberCurrentPasswordInput("x".repeat(MEMBER_CURRENT_PASSWORD_MAX_LENGTH + 1)),
    { ok: false, code: "current_password_invalid" },
  );

  assert.equal(getMemberCurrentPasswordFieldError("", "none"), null);
  assert.equal(getMemberCurrentPasswordFieldError("", "password"), "현재 비밀번호를 입력해 주세요.");
  assert.equal(getMemberCurrentPasswordFieldError("secret-1!", "password"), null);
  assert.equal(
    getMemberCurrentPasswordFieldError("x".repeat(MEMBER_CURRENT_PASSWORD_MAX_LENGTH + 1), "password"),
    MEMBER_RECENT_AUTH_ERRORS.current_password_invalid.message,
  );
});

test("최근 인증 오류 코드는 공용 메시지와 화면 상태 변화로 매핑된다", () => {
  assert.equal(isMemberRecentAuthErrorCode("recent_auth_required"), true);
  assert.equal(isMemberRecentAuthErrorCode("toString"), false);
  assert.equal(isMemberRecentAuthErrorCode(undefined), false);

  assert.deepEqual(getMemberRecentAuthFeedback("recent_auth_required"), {
    requirement: "password",
    fieldError: "보안을 위해 현재 비밀번호를 입력해 주세요.",
  });
  assert.deepEqual(getMemberRecentAuthFeedback("current_password_invalid"), {
    fieldError: "현재 비밀번호가 올바르지 않습니다.",
  });
  assert.deepEqual(getMemberRecentAuthFeedback("reauthentication_required"), {
    requirement: "reauthentication",
    formError: "보안을 위해 로그아웃한 뒤 다시 로그인해 주세요.",
  });
  assert.equal(getMemberRecentAuthFeedback("recent_auth_blocked").formError, MEMBER_RECENT_AUTH_ERRORS.recent_auth_blocked.message);
  assert.equal(MEMBER_RECENT_AUTH_ERRORS.recent_auth_blocked.status, 429);
});

test("회원 세션 토큰의 authenticatedAt은 선택 필드이며 발급 시각보다 늦을 수 없다", () => {
  const secret = randomBytes(32).toString("hex");
  const now = Date.now();
  const base = {
    userId: "m-1",
    authSessionVersion: 1,
    authenticationMethod: "manual",
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
  };
  const sign = (payload: object) => {
    const json = JSON.stringify(payload);
    return `${json}.${createHmac("sha256", secret).update(json).digest("hex")}`;
  };
  assert.equal(parseUserSessionToken(sign(base), secret)?.authenticatedAt, undefined);
  assert.equal(parseUserSessionToken(sign({ ...base, authenticatedAt: now - 5_000 }), secret)?.authenticatedAt, now - 5_000);
  assert.equal(parseUserSessionToken(sign({ ...base, authenticatedAt: now }), secret), null);
  assert.equal(parseUserSessionToken(sign({ ...base, authenticatedAt: "1" }), secret), null);
});

test("탈퇴·이메일 바인딩 API는 세션 확인 뒤 최근 인증을 강제하고 화면은 같은 규칙 모듈을 쓴다", () => {
  const deleteRoute = read("src/app/api/mm/delete/route.ts");
  const emailSendRoute = read("src/app/api/member/email/send/route.ts");
  const serverHelper = read("src/lib/member-recent-auth.server.ts");
  const userAuth = read("src/lib/user-auth.ts");

  for (const route of [deleteRoute, emailSendRoute]) {
    const sessionIndex = route.indexOf("requireMemberApiSession()");
    const recentAuthIndex = route.indexOf("verifyMemberRecentAuthentication(");
    assert.ok(sessionIndex > 0 && recentAuthIndex > sessionIndex);
    assert.match(route, /currentPassword: body\?\.currentPassword/);
    assert.match(route, /getMemberRecentAuthErrorBody\(recentAuth\.code\)/);
  }
  assert.ok(
    deleteRoute.indexOf("verifyMemberRecentAuthentication(") < deleteRoute.indexOf("softDeleteMember(session.userId)"),
  );
  assert.ok(
    emailSendRoute.indexOf("verifyMemberRecentAuthentication(") < emailSendRoute.indexOf("issueMemberEmailChallenge("),
  );
  assert.ok(
    emailSendRoute.indexOf("verifyMemberRecentAuthentication(") < emailSendRoute.indexOf('.eq("email_normalized", email)'),
    "account-existence checks must not run before recent authentication",
  );

  assert.match(serverHelper, /^import "server-only";/);
  assert.match(serverHelper, /getMemberAuthBlockingState\("recent-auth", throttle\)/);
  assert.match(serverHelper, /recordMemberAuthAttempt\("recent-auth", throttle, false\)/);
  assert.match(serverHelper, /verifyPassword\(parsed\.currentPassword/);
  assert.match(userAuth, /if \(freshAuthentication\) \{\s*return now;\s*\}/);

  for (const view of [
    "src/components/settings/MemberAccountDeletionView.tsx",
    "src/components/certification/MemberEmailVerificationView.tsx",
  ]) {
    const source = read(view);
    assert.match(source, /getMemberCurrentPasswordFieldError\(/, view);
    assert.match(source, /isMemberRecentAuthErrorCode\(/, view);
    assert.match(source, /<MemberRecentAuthField/, view);
  }
});
