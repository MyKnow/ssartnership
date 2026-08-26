import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const MEMBER_ID = "00000000-0000-4000-8000-000000000319";
const OTHER_MEMBER_ID = "00000000-0000-4000-8000-000000000320";
const EMAIL = "member@example.com";
const CODE_HASH = "a".repeat(64);
const WRONG_CODE_HASH = "b".repeat(64);
const RESERVATION_HASH = "c".repeat(64);
const NOW = "2026-08-13T04:58:12.000Z";

const mockRepositoryModulePromise = import(
  new URL(
    "../src/lib/repositories/mock/member-email-verification-repository.mock.ts",
    import.meta.url,
  ).href
);
const supabaseRepositoryModulePromise = import(
  new URL(
    "../src/lib/repositories/supabase/member-email-verification-repository.supabase.ts",
    import.meta.url,
  ).href
);
const serviceModulePromise = import(
  new URL("../src/lib/member-email-verification-service.ts", import.meta.url).href
);

type MockOptions = {
  challengeOverrides?: Record<string, unknown>;
  memberOverrides?: Record<string, unknown>;
  otherMembers?: Array<Record<string, unknown>>;
  reservedEmailHashes?: string[];
  failAfterMemberUpdate?: boolean;
};

async function createRepository(options: MockOptions = {}) {
  const { MockMemberEmailVerificationRepository } =
    await mockRepositoryModulePromise;
  return new MockMemberEmailVerificationRepository({
    now: NOW,
    members: [
      {
        id: MEMBER_ID,
        emailNormalized: null,
        emailVerifiedAt: null,
        deletedAt: null,
        ...options.memberOverrides,
      },
      ...(options.otherMembers ?? []),
    ],
    challenges: [
      {
        id: "challenge-1",
        memberId: MEMBER_ID,
        emailNormalized: EMAIL,
        purpose: "email_verify",
        codeHash: CODE_HASH,
        expiresAt: "2026-08-13T05:08:12.000Z",
        verifiedAt: null,
        consumedAt: null,
        attemptCount: 0,
        createdAt: "2026-08-13T04:57:12.000Z",
        ...options.challengeOverrides,
      },
    ],
    reservedEmailHashes: options.reservedEmailHashes ?? [],
    failAfterMemberUpdate: options.failAfterMemberUpdate ?? false,
  });
}

const completionInput = {
  memberId: MEMBER_ID,
  emailNormalized: EMAIL,
  emailReservationHash: RESERVATION_HASH,
  codeHash: CODE_HASH,
};

test("회원 이메일 완료 mock은 회원 갱신과 challenge 소비를 한 원자 결과로 반영한다", async () => {
  const repository = await createRepository();

  assert.deepEqual(
    await repository.completeMemberEmailVerification(completionInput),
    { verified: true },
  );
  const snapshot = repository.getSnapshot();
  const member = snapshot.members.find((item: { id: string }) => item.id === MEMBER_ID);
  const challenge = snapshot.challenges.find(
    (item: { id: string }) => item.id === "challenge-1",
  );

  assert.equal(member?.emailNormalized, EMAIL);
  assert.equal(member?.emailVerifiedAt, NOW);
  assert.equal(challenge?.verifiedAt, NOW);
  assert.equal(challenge?.consumedAt, NOW);
  assert.equal(challenge?.attemptCount, 1);
});

test("회원 갱신 뒤 challenge 저장이 실패해도 mock 원자 경계는 부분 성공을 남기지 않는다", async () => {
  const repository = await createRepository({ failAfterMemberUpdate: true });

  await assert.rejects(
    repository.completeMemberEmailVerification(completionInput),
    (error: unknown) =>
      error instanceof Error &&
      error.name === "MemberEmailVerificationStorageError" &&
      !error.message.includes(EMAIL),
  );
  const snapshot = repository.getSnapshot();
  const member = snapshot.members.find((item: { id: string }) => item.id === MEMBER_ID);
  const challenge = snapshot.challenges.find(
    (item: { id: string }) => item.id === "challenge-1",
  );

  assert.equal(member?.emailNormalized, null);
  assert.equal(member?.emailVerifiedAt, null);
  assert.equal(challenge?.verifiedAt, null);
  assert.equal(challenge?.consumedAt, null);
});

test("동시에 같은 인증 코드를 재사용해도 한 요청만 완료된다", async () => {
  const repository = await createRepository();

  const results = await Promise.all([
    repository.completeMemberEmailVerification(completionInput),
    repository.completeMemberEmailVerification(completionInput),
  ]);

  assert.equal(results.filter((result) => result.verified).length, 1);
  assert.deepEqual(
    results.find((result) => !result.verified),
    { verified: false, reason: "challenge_consumed" },
  );
});

test("새 이메일 코드가 발급되면 이전 이메일의 코드는 더 이상 완료할 수 없다", async () => {
  const { MockMemberEmailVerificationRepository } =
    await mockRepositoryModulePromise;
  const repository = new MockMemberEmailVerificationRepository({
    now: NOW,
    members: [
      {
        id: MEMBER_ID,
        emailNormalized: null,
        emailVerifiedAt: null,
        deletedAt: null,
      },
    ],
    challenges: [
      {
        id: "challenge-old",
        memberId: MEMBER_ID,
        emailNormalized: EMAIL,
        purpose: "email_verify",
        codeHash: CODE_HASH,
        expiresAt: "2026-08-13T05:08:12.000Z",
        verifiedAt: null,
        consumedAt: null,
        attemptCount: 0,
        createdAt: "2026-08-13T04:56:12.000Z",
        deliveryStatus: "sent",
      },
      {
        id: "challenge-new",
        memberId: MEMBER_ID,
        emailNormalized: "new@example.com",
        purpose: "email_verify",
        codeHash: WRONG_CODE_HASH,
        expiresAt: "2026-08-13T05:08:12.000Z",
        verifiedAt: null,
        consumedAt: null,
        attemptCount: 0,
        createdAt: "2026-08-13T04:57:12.000Z",
        deliveryStatus: "sent",
      },
    ],
  });

  assert.deepEqual(
    await repository.completeMemberEmailVerification(completionInput),
    { verified: false, reason: "challenge_missing" },
  );
  assert.equal(repository.getSnapshot().members[0]?.emailNormalized, null);
});

test("전송 완료로 표시되지 않은 코드는 인증에 사용할 수 없다", async () => {
  const repository = await createRepository({
    challengeOverrides: { deliveryStatus: "pending" },
  });

  assert.deepEqual(
    await repository.completeMemberEmailVerification(completionInput),
    { verified: false, reason: "challenge_missing" },
  );
});

test("invalid, expired, consumed, exhausted challenge는 회원 이메일을 갱신하지 않는다", async () => {
  const scenarios = [
    {
      name: "invalid",
      input: { ...completionInput, codeHash: WRONG_CODE_HASH },
      options: {},
      reason: "invalid_code",
      expectedAttempts: 1,
    },
    {
      name: "expired",
      input: completionInput,
      options: { challengeOverrides: { expiresAt: "2026-08-13T04:58:11.000Z" } },
      reason: "challenge_expired",
      expectedAttempts: 0,
    },
    {
      name: "consumed",
      input: completionInput,
      options: { challengeOverrides: { consumedAt: "2026-08-13T04:58:00.000Z" } },
      reason: "challenge_consumed",
      expectedAttempts: 0,
    },
    {
      name: "exhausted",
      input: completionInput,
      options: { challengeOverrides: { attemptCount: 10 } },
      reason: "attempts_exhausted",
      expectedAttempts: 10,
    },
  ] as const;

  for (const scenario of scenarios) {
    const repository = await createRepository(scenario.options);
    assert.deepEqual(
      await repository.completeMemberEmailVerification(scenario.input),
      { verified: false, reason: scenario.reason },
      scenario.name,
    );
    const snapshot = repository.getSnapshot();
    assert.equal(
      snapshot.members.find((item: { id: string }) => item.id === MEMBER_ID)?.emailNormalized,
      null,
      scenario.name,
    );
    assert.equal(snapshot.challenges[0]?.attemptCount, scenario.expectedAttempts);
  }
});

test("다른 활성 회원과 탈퇴 예약 이메일은 트랜잭션 안에서 다시 거절한다", async () => {
  const duplicateRepository = await createRepository({
    otherMembers: [
      {
        id: OTHER_MEMBER_ID,
        emailNormalized: EMAIL,
        emailVerifiedAt: NOW,
        deletedAt: null,
      },
    ],
  });
  assert.deepEqual(
    await duplicateRepository.completeMemberEmailVerification(completionInput),
    { verified: false, reason: "email_conflict" },
  );

  const reservedRepository = await createRepository({
    reservedEmailHashes: [RESERVATION_HASH],
  });
  assert.deepEqual(
    await reservedRepository.completeMemberEmailVerification(completionInput),
    { verified: false, reason: "email_reserved" },
  );
});

test("Supabase repository는 RPC 결과만 domain 결과로 허용하고 provider 오류를 마스킹한다", async () => {
  const {
    MemberEmailVerificationStorageError,
    SupabaseMemberEmailVerificationRepository,
  } = await supabaseRepositoryModulePromise;
  const calls: Array<Record<string, unknown>> = [];
  const successRepository = new SupabaseMemberEmailVerificationRepository(
    async (functionName: string, parameters: Record<string, unknown>) => {
      calls.push({ functionName, parameters });
      return { data: { verified: true }, error: null };
    },
  );

  assert.deepEqual(
    await successRepository.completeMemberEmailVerification(completionInput),
    { verified: true },
  );
  assert.deepEqual(calls, [
    {
      functionName: "complete_member_email_verification",
      parameters: {
        p_member_id: MEMBER_ID,
        p_email_normalized: EMAIL,
        p_email_reservation_hash: RESERVATION_HASH,
        p_code_hash: CODE_HASH,
      },
    },
  ]);

  const providerDetail = "duplicate key includes member@example.com and secret-db-host";
  const failureRepository = new SupabaseMemberEmailVerificationRepository(
    async () => ({ data: null, error: { message: providerDetail } }),
  );
  await assert.rejects(
    failureRepository.completeMemberEmailVerification(completionInput),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(error instanceof MemberEmailVerificationStorageError);
      assert.equal(error.message, "member_email_verification_storage_failed");
      assert.doesNotMatch(JSON.stringify(error), /member@example\.com|secret-db-host/);
      return true;
    },
  );

  const malformedRepository = new SupabaseMemberEmailVerificationRepository(
    async () => ({ data: { verified: false, reason: providerDetail }, error: null }),
  );
  await assert.rejects(
    malformedRepository.completeMemberEmailVerification(completionInput),
    MemberEmailVerificationStorageError,
  );
});

test("service는 내부 reason을 PII 없는 고정 HTTP 실패 계약으로 제한한다", async () => {
  const { getMemberEmailVerificationHttpFailure } = await serviceModulePromise;
  assert.deepEqual(getMemberEmailVerificationHttpFailure("email_conflict"), {
    status: 409,
    message: "이미 다른 계정에서 사용 중인 이메일입니다.",
  });
  assert.deepEqual(getMemberEmailVerificationHttpFailure("email_reserved"), {
    status: 409,
    message: "사용할 수 없는 이메일입니다.",
  });
  assert.deepEqual(getMemberEmailVerificationHttpFailure("member_missing"), {
    status: 401,
    message: "회원 정보를 확인하지 못했습니다.",
  });
  assert.deepEqual(getMemberEmailVerificationHttpFailure("challenge_expired"), {
    status: 400,
    message: "인증 코드가 올바르지 않거나 만료되었습니다.",
  });
});

test("회원 이메일 verify route는 원자 service에 위임하면서 기존 신뢰 경계를 보존한다", () => {
  const route = read("src/app/api/member/email/verify/route.ts");

  assert.match(route, /isTrustedSameOriginRequest/);
  assert.match(route, /allowedContentTypes:\s*\["application\/json"\]/);
  assert.match(route, /getSignedUserSession/);
  assert.match(route, /normalizeMemberEmail/);
  assert.match(route, /\^\\d\{6\}\$/);
  assert.match(route, /getMemberEmailVerificationBlockingState\("verify"/);
  assert.match(route, /status:\s*"blocked"/);
  assert.match(route, /properties:\s*\{ stage:\s*"verify", reason:\s*"rate_limit" \}/);
  assert.match(route, /hashMemberEmailVerificationCode/);
  assert.match(route, /buildReservedMemberIdentifierHashes/);
  assert.match(route, /completeMemberEmailVerification/);
  assert.match(route, /recordMemberEmailVerificationAttempt/);
  assert.match(route, /eventName:\s*"member_email_verification"/);
  assert.doesNotMatch(route, /\.from\("members"\)/);
  assert.doesNotMatch(route, /\.from\("member_email_challenges"\)/);
  assert.doesNotMatch(route, /error\.message|String\(error\)|properties:\s*\{[^}]*email/);
});

test("원자 완료 RPC는 잠금·재검증·rollback·service-role 권한 계약을 고정한다", () => {
  const migrationPath =
    "supabase/migrations/20260813135812_complete_member_email_verification_atomically.sql";
  const migration = read(migrationPath);
  const schema = read("supabase/schema.sql");

  assert.match(
    migration,
    /create or replace function public\.complete_member_email_verification\(/i,
  );
  assert.match(migration, /language plpgsql\s+security invoker\s+set search_path = pg_catalog, public/i);
  assert.match(
    migration,
    /from public\.members[\s\S]+where id = p_member_id[\s\S]+deleted_at is null[\s\S]+for update/i,
  );
  assert.match(
    migration,
    /from public\.member_email_challenges[\s\S]+member_id = p_member_id[\s\S]+email_normalized = p_email_normalized[\s\S]+purpose = 'email_verify'[\s\S]+order by created_at desc, id desc[\s\S]+for update/i,
  );
  assert.match(migration, /completion_time timestamp with time zone\s*;/i);
  assert.doesNotMatch(
    migration,
    /completion_time timestamp with time zone\s*:=/i,
  );
  assert.ok(
    migration.indexOf("completion_time := pg_catalog.clock_timestamp();") >
      migration.indexOf("order by created_at desc, id desc"),
  );
  assert.match(migration, /challenge_row\.consumed_at is not null/i);
  assert.match(migration, /challenge_row\.expires_at <= completion_time/i);
  assert.match(migration, /challenge_row\.attempt_count >= 10/i);
  assert.match(migration, /challenge_row\.code_hash <> p_code_hash/i);
  assert.match(
    migration,
    /member\.email_normalized = p_email_normalized[\s\S]+member\.id <> p_member_id[\s\S]+member\.deleted_at is null/i,
  );
  assert.match(
    migration,
    /reservation\.identifier_kind = 'email'[\s\S]+reservation\.identifier_hash = p_email_reservation_hash/i,
  );
  assert.match(
    migration,
    /begin[\s\S]+update public\.members[\s\S]+email_verified_at = completion_time[\s\S]+update public\.member_email_challenges[\s\S]+consumed_at = completion_time[\s\S]+exception[\s\S]+when unique_violation/i,
  );
  assert.match(migration, /raise exception using[\s\S]+member_email_challenge_state_conflict/i);
  assert.match(
    migration,
    /revoke all on function public\.complete_member_email_verification\([^)]+\) from public/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.complete_member_email_verification\([^)]+\) from anon/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.complete_member_email_verification\([^)]+\) from authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.complete_member_email_verification\([^)]+\) to service_role/i,
  );
  assert.ok(schema.includes(migration.trim()));
});
