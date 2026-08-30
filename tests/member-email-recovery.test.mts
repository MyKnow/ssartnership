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
  const migrationPath =
    "supabase/migrations/20260831033742_harden_member_email_recovery_challenge.sql";
  const migration = read(migrationPath);
  const schema = read("supabase/schema.sql");

  assert.match(sendRoute, /issueMemberEmailChallenge/);
  assert.match(sendRoute, /SupabaseMemberEmailRecoveryChallengeRepository/);
  assert.match(sendRoute, /MEMBER_EMAIL_RESEND_COOLDOWN_SECONDS/);
  assert.match(sendRoute, /hashMemberEmailVerificationCode/);
  assert.doesNotMatch(sendRoute, /code:\s*code/);
  assert.doesNotMatch(sendRoute, /\.from\("member_email_challenges"\)/);
  assert.match(verifyRoute, /completeMemberEmailRecovery/);
  assert.doesNotMatch(verifyRoute, /\.rpc\(/);
  assert.match(verifyRoute, /setUserSession/);
  assert.match(verifyRoute, /clearMemberEmailRecoverySession/);
  assert.match(migration, /challenge_row\.attempt_count\s*>=\s*5/);
  assert.match(migration, /challenge_row\.delivery_status <> 'sent'/);
  assert.match(migration, /purpose = 'email_recovery'[\s\S]+order by created_at desc, id desc/);
  assert.match(migration, /auth_session_version\s*=\s*auth_session_version\s*\+\s*1/i);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /resend_available_at > reservation_time/);
  assert.match(migration, /delivery_status[\s\S]+values[\s\S]+'pending'/);
  assert.ok(schema.includes(migration.trim()));
});

test("복구 challenge repository는 전용 RPC 수명주기만 호출하고 오류 세부정보를 마스킹한다", async () => {
  const {
    MemberEmailChallengeStorageError,
    SupabaseMemberEmailRecoveryChallengeRepository,
  } = await import(
    new URL(
      "../src/lib/repositories/supabase/member-email-recovery-challenge-repository.supabase.ts",
      import.meta.url,
    ).href
  );
  const calls: string[] = [];
  const repository = new SupabaseMemberEmailRecoveryChallengeRepository(
    async (name: string) => {
      calls.push(name);
      if (name === "reserve_member_email_recovery_challenge") {
        return {
          data: [{
            challenge_id: "00000000-0000-4000-8000-000000000411",
            accepted: true,
            retry_after_seconds: 0,
          }],
          error: null,
        };
      }
      return { data: true, error: null };
    },
  );

  await repository.reserve({
    memberId: "00000000-0000-4000-8000-000000000410",
    emailNormalized: "member@example.com",
    codeHash: "a".repeat(64),
    expiresAt: "2026-08-31T04:00:00.000Z",
    resendAvailableAt: "2026-08-31T03:51:00.000Z",
  });
  await repository.markSent("00000000-0000-4000-8000-000000000411");
  await repository.deletePending("00000000-0000-4000-8000-000000000411");
  assert.deepEqual(calls, [
    "reserve_member_email_recovery_challenge",
    "mark_member_email_recovery_challenge_sent",
    "delete_pending_member_email_recovery_challenge",
  ]);

  const failed = new SupabaseMemberEmailRecoveryChallengeRepository(
    async () => ({
      data: null,
      error: { message: "secret-db-host member@example.com" },
    }),
  );
  await assert.rejects(
    failed.reserve({
      memberId: "00000000-0000-4000-8000-000000000410",
      emailNormalized: "member@example.com",
      codeHash: "a".repeat(64),
      expiresAt: "2026-08-31T04:00:00.000Z",
      resendAvailableAt: "2026-08-31T03:51:00.000Z",
    }),
    (error: unknown) => {
      assert.ok(error instanceof MemberEmailChallengeStorageError);
      assert.doesNotMatch(
        JSON.stringify(error),
        /secret-db-host|member@example\.com/,
      );
      return true;
    },
  );
});

test("복구 완료 repository와 HTTP 매퍼는 RPC 결과를 고정 계약으로 제한한다", async () => {
  const {
    MemberEmailRecoveryStorageError,
    SupabaseMemberEmailRecoveryRepository,
  } = await import(
    new URL(
      "../src/lib/repositories/supabase/member-email-recovery-repository.supabase.ts",
      import.meta.url,
    ).href
  );
  const service = await import(
    new URL("../src/lib/member-email-verification-service.ts", import.meta.url)
      .href
  );
  const input = {
    memberId: "00000000-0000-4000-8000-000000000410",
    emailNormalized: "member@example.com",
    emailReservationHash: "b".repeat(64),
    codeHash: "a".repeat(64),
  };
  const repository = new SupabaseMemberEmailRecoveryRepository(async () => ({
    data: { verified: true, mustChangePassword: true },
    error: null,
  }));
  assert.deepEqual(await repository.completeMemberEmailRecovery(input), {
    verified: true,
    mustChangePassword: true,
  });

  const malformed = new SupabaseMemberEmailRecoveryRepository(async () => ({
    data: {
      verified: false,
      reason: "secret-db-host member@example.com",
    },
    error: null,
  }));
  await assert.rejects(
    malformed.completeMemberEmailRecovery(input),
    MemberEmailRecoveryStorageError,
  );
  assert.deepEqual(service.getMemberEmailRecoveryHttpFailure("email_conflict"), {
    status: 409,
    message: "사용할 수 없는 이메일입니다. 다른 이메일로 다시 인증해 주세요.",
  });
  assert.deepEqual(service.getMemberEmailRecoveryHttpFailure("invalid_code"), {
    status: 400,
    message: "인증 코드가 올바르지 않거나 만료되었습니다.",
  });
});
