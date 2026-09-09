import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("회원 이메일 보안 로그는 인증과 복구의 이벤트·단계를 공용 계약으로 변환한다", async () => {
  const { buildMemberEmailSecurityLogInput } = await import(
    new URL("../src/lib/member-email-security-log.ts", import.meta.url).href
  );
  const context = {
    path: "/api/member/email/verify",
    ipAddress: "203.0.113.10",
    requestId: "request-1",
  };

  assert.deepEqual(
    buildMemberEmailSecurityLogInput({
      context,
      flow: "verification",
      stage: "verify",
      status: "failure",
      actorId: "member-1",
      reason: "state_update_failed",
    }),
    {
      ...context,
      eventName: "member_email_verification",
      status: "failure",
      actorType: "member",
      actorId: "member-1",
      properties: {
        stage: "verify",
        reason: "state_update_failed",
      },
    },
  );
  assert.deepEqual(
    buildMemberEmailSecurityLogInput({
      context,
      flow: "recovery",
      stage: "send",
      status: "blocked",
      actorId: "member-2",
      reason: "resend_cooldown",
    }),
    {
      ...context,
      eventName: "member_email_recovery",
      status: "blocked",
      actorType: "member",
      actorId: "member-2",
      properties: {
        stage: "email_send",
        reason: "resend_cooldown",
      },
    },
  );
});

test("회원 이메일 인증과 복구 라우트는 같은 보안 로그 분기 수를 유지한다", () => {
  const routePaths = [
    "src/app/api/member/email/send/route.ts",
    "src/app/api/member/email/verify/route.ts",
    "src/app/api/member/recovery/email/send/route.ts",
    "src/app/api/member/recovery/email/verify/route.ts",
  ];

  for (const routePath of routePaths) {
    const source = read(routePath);
    assert.match(source, /logMemberEmailSecurity/);
    assert.doesNotMatch(source, /logAuthSecurity/);
    assert.equal(
      source.match(/logMemberEmailSecurity\(\{/g)?.length,
      5,
      routePath,
    );
  }

  const recoverySend = read(
    "src/app/api/member/recovery/email/send/route.ts",
  );
  assert.match(recoverySend, /reason: blockingState\.code/);
  assert.match(recoverySend, /reason: "rate_limit"/);
  assert.match(recoverySend, /reason: "resend_cooldown"/);

  const recoveryVerify = read(
    "src/app/api/member/recovery/email/verify/route.ts",
  );
  assert.match(recoveryVerify, /reason: blockingState\.code/);
  assert.match(recoveryVerify, /reason: "rate_limit"/);
  assert.match(recoveryVerify, /reason: "state_update_failed"/);
});
