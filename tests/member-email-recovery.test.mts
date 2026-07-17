import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("MM 장애 이메일 복구는 기존 비밀번호와 15분 제한 세션을 모두 요구한다", () => {
  const session = read("src/lib/member-email-recovery-session.ts");
  const startRoute = read("src/app/api/member/recovery/start/route.ts");
  const authentication = read("src/lib/member-authentication.ts");

  assert.match(session, /MEMBER_EMAIL_RECOVERY_SESSION_TTL_MS\s*=\s*15\s*\*\s*60\s*\*\s*1000/);
  assert.match(session, /authSessionVersion/);
  assert.match(session, /httpOnly:\s*true/);
  assert.match(startRoute, /resolveMemberForEmailRecovery/);
  assert.match(startRoute, /verifyPassword\(/);
  assert.match(startRoute, /setMemberEmailRecoverySession/);
  assert.doesNotMatch(startRoute, /setUserSession\(/);
  assert.match(authentication, /resolveRecoverableMemberByMattermostUsername/);
  assert.match(authentication, /mattermost_login_disabled_at/);
});

test("이메일 소유 확인은 코드 hash만 저장하고 원자 RPC 성공 뒤에만 로그인 세션을 발급한다", () => {
  const sendRoute = read("src/app/api/member/recovery/email/send/route.ts");
  const verifyRoute = read("src/app/api/member/recovery/email/verify/route.ts");
  const migration = read("supabase/migrations/20260717020528_add_member_email_recovery_and_existing_member_recovery.sql");

  assert.match(sendRoute, /purpose:\s*"email_recovery"/);
  assert.match(sendRoute, /hashMemberEmailVerificationCode/);
  assert.doesNotMatch(sendRoute, /code:\s*code/);
  assert.match(verifyRoute, /complete_member_email_recovery/);
  assert.match(verifyRoute, /setUserSession/);
  assert.match(verifyRoute, /clearMemberEmailRecoverySession/);
  assert.match(migration, /challenge_row\.attempt_count\s*>=\s*5/);
  assert.match(migration, /set\s+verified_at\s*=\s*now\(\),\s*consumed_at\s*=\s*now\(\)/i);
  assert.match(migration, /auth_session_version\s*=\s*auth_session_version\s*\+\s*1/i);
});
