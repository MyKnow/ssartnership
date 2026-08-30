import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const timingModulePromise = import(
  new URL("../src/lib/member-email-verification-timing.ts", import.meta.url)
    .href
);
const challengeRepositoryModulePromise = import(
  new URL(
    "../src/lib/repositories/supabase/member-email-verification-challenge-repository.supabase.ts",
    import.meta.url,
  ).href
);

test("회원 이메일 인증 시간은 10분 유효·60초 재전송 대기 계약을 따른다", async () => {
  const {
    MEMBER_EMAIL_RESEND_COOLDOWN_SECONDS,
    MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS,
    formatMemberEmailRemainingTime,
    getMemberEmailDeadline,
    getMemberEmailRemainingSeconds,
    resolveMemberEmailDeadline,
  } = await timingModulePromise;

  assert.equal(MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS, 600);
  assert.equal(MEMBER_EMAIL_RESEND_COOLDOWN_SECONDS, 60);
  assert.equal(getMemberEmailDeadline(600, 600, 1_000), 601_000);
  assert.equal(getMemberEmailDeadline(undefined, 60, 1_000), 61_000);
  assert.equal(getMemberEmailDeadline(-1, 60, 1_000), 61_000);
  assert.equal(
    resolveMemberEmailDeadline("1970-01-01T00:01:01.000Z", 600, 600, 1_000),
    61_000,
  );
  assert.equal(resolveMemberEmailDeadline("invalid", 60, 60, 1_000), 61_000);
  assert.equal(getMemberEmailRemainingSeconds(61_000, 1_000), 60);
  assert.equal(getMemberEmailRemainingSeconds(61_000, 60_001), 1);
  assert.equal(getMemberEmailRemainingSeconds(61_000, 61_000), 0);
  assert.equal(formatMemberEmailRemainingTime(600), "10:00");
  assert.equal(formatMemberEmailRemainingTime(61), "01:01");
  assert.equal(formatMemberEmailRemainingTime(0), "00:00");
});

test("인증 코드 발급 RPC는 회원 단위 잠금·재전송 대기·최신 코드 우선 계약을 원자적으로 보장한다", () => {
  const migrationPath =
    "supabase/migrations/20260823144046_add_member_email_resend_cooldown.sql";
  const migration = read(migrationPath);
  const schema = read("supabase/schema.sql");

  assert.match(migration, /add column if not exists resend_available_at/i);
  assert.match(migration, /add column if not exists delivery_status/i);
  assert.match(
    migration,
    /create or replace function public\.reserve_member_email_verification_challenge\(/i,
  );
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(
    migration,
    /purpose = 'email_verify'[\s\S]+consumed_at is null[\s\S]+expires_at > reservation_time[\s\S]+order by created_at desc, id desc[\s\S]+for update/i,
  );
  assert.match(migration, /resend_available_at > reservation_time/i);
  assert.match(migration, /extract\s*\(\s*epoch from/i);
  assert.doesNotMatch(migration, /pg_catalog\.extract/i);
  assert.doesNotMatch(schema, /pg_catalog\.extract/i);
  assert.match(
    migration,
    /update public\.member_email_challenges[\s\S]+set consumed_at = reservation_time[\s\S]+purpose = 'email_verify'/i,
  );
  assert.match(migration, /delivery_status[\s\S]+values[\s\S]+'pending'/i);
  assert.match(
    migration,
    /create or replace function public\.mark_member_email_verification_challenge_sent\(/i,
  );
  assert.match(
    migration,
    /create or replace function public\.delete_pending_member_email_verification_challenge\(/i,
  );
  assert.match(
    migration,
    /create or replace function public\.complete_member_email_verification\([\s\S]+purpose = 'email_verify'[\s\S]+order by created_at desc, id desc[\s\S]+for update/i,
  );
  assert.match(
    migration,
    /challenge_row\.email_normalized <> p_email_normalized/i,
  );
  assert.match(migration, /challenge_row\.delivery_status <> 'sent'/i);
  assert.match(
    migration,
    /grant execute on function public\.reserve_member_email_verification_challenge\([^)]+\) to service_role/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.mark_member_email_verification_challenge_sent\([^)]+\) to service_role/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.delete_pending_member_email_verification_challenge\([^)]+\) to service_role/i,
  );
  assert.match(
    schema,
    /create table if not exists public\.member_email_challenges \([\s\S]+resend_available_at timestamp with time zone not null default now\(\)[\s\S]+delivery_status text not null default 'sent'[\s\S]+member_email_challenges_delivery_status_check/i,
  );
  assert.match(
    schema,
    /create index if not exists member_email_challenges_active_email_verify_idx/i,
  );
  assert.match(
    schema,
    /create or replace function public\.reserve_member_email_verification_challenge\(/i,
  );
});

test("인증 코드 전송 API는 원자 예약과 서버 재전송 대기 계약을 사용한다", () => {
  const route = read("src/app/api/member/email/send/route.ts");

  assert.match(route, /issueMemberEmailChallenge/);
  assert.match(route, /MemberEmailChallengeIssueError/);
  assert.match(route, /MEMBER_EMAIL_RESEND_COOLDOWN_SECONDS/);
  assert.match(route, /code:\s*"resend_cooldown"/);
  assert.match(route, /retryAfterSeconds/);
  assert.match(route, /"Retry-After"/);
  assert.match(route, /resendAvailableInSeconds/);
  assert.match(route, /expiresAt/);
  assert.match(route, /resendAvailableAt/);
  assert.doesNotMatch(route, /\.from\("member_email_challenges"\)/);
});

test("공통 challenge 발급 수명주기는 전송 완료와 실패 rollback을 한 경계로 묶는다", async () => {
  const {
    issueMemberEmailChallenge,
    MemberEmailChallengeIssueError,
  } = await import(
    new URL(
      "../src/lib/member-email-verification-challenge.ts",
      import.meta.url,
    ).href
  );
  const input = {
    memberId: "00000000-0000-4000-8000-000000000401",
    emailNormalized: "member@example.com",
    codeHash: "a".repeat(64),
    expiresAt: "2026-08-31T04:00:00.000Z",
    resendAvailableAt: "2026-08-31T03:51:00.000Z",
  };
  const calls: string[] = [];
  const repository = {
    reserve: async () => {
      calls.push("reserve");
      return {
        accepted: true as const,
        challengeId: "00000000-0000-4000-8000-000000000402",
        retryAfterSeconds: 0 as const,
      };
    },
    markSent: async () => {
      calls.push("mark-sent");
    },
    deletePending: async () => {
      calls.push("delete-pending");
    },
  };

  assert.equal(
    (
      await issueMemberEmailChallenge(input, {
        repository,
        beforeDelivery: async () => {
          calls.push("before-delivery");
        },
        deliver: async () => {
          calls.push("deliver");
        },
      })
    ).accepted,
    true,
  );
  assert.deepEqual(calls, [
    "reserve",
    "before-delivery",
    "deliver",
    "mark-sent",
  ]);

  calls.length = 0;
  await assert.rejects(
    issueMemberEmailChallenge(input, {
      repository,
      deliver: async () => {
        calls.push("deliver");
        throw new Error("provider detail");
      },
    }),
    MemberEmailChallengeIssueError,
  );
  assert.deepEqual(calls, ["reserve", "deliver", "delete-pending"]);

  calls.length = 0;
  await assert.rejects(
    issueMemberEmailChallenge(input, {
      repository,
      beforeDelivery: async () => {
        calls.push("before-delivery");
        throw new Error("required attempt record failed");
      },
      deliver: async () => {
        calls.push("deliver");
      },
    }),
    MemberEmailChallengeIssueError,
  );
  assert.deepEqual(calls, [
    "reserve",
    "before-delivery",
    "delete-pending",
  ]);
});

test("공통 challenge 발급 수명주기는 재전송 대기 중 delivery를 실행하지 않는다", async () => {
  const { issueMemberEmailChallenge } = await import(
    new URL(
      "../src/lib/member-email-verification-challenge.ts",
      import.meta.url,
    ).href
  );
  let delivered = false;
  const result = await issueMemberEmailChallenge(
    {
      memberId: "00000000-0000-4000-8000-000000000401",
      emailNormalized: "member@example.com",
      codeHash: "a".repeat(64),
      expiresAt: "2026-08-31T04:00:00.000Z",
      resendAvailableAt: "2026-08-31T03:51:00.000Z",
    },
    {
      repository: {
        reserve: async () => ({
          accepted: false as const,
          challengeId: "00000000-0000-4000-8000-000000000402",
          retryAfterSeconds: 42,
        }),
        markSent: async () => {
          throw new Error("must not run");
        },
        deletePending: async () => {
          throw new Error("must not run");
        },
      },
      deliver: async () => {
        delivered = true;
      },
    },
  );

  assert.deepEqual(result, {
    accepted: false,
    challengeId: "00000000-0000-4000-8000-000000000402",
    retryAfterSeconds: 42,
  });
  assert.equal(delivered, false);
});

test("challenge repository는 RPC 결과를 검증하고 provider 세부 오류를 마스킹한다", async () => {
  const {
    MemberEmailChallengeStorageError,
    SupabaseMemberEmailVerificationChallengeRepository,
  } = await challengeRepositoryModulePromise;
  const calls: Array<{ name: string; parameters: Record<string, unknown> }> =
    [];
  const repository = new SupabaseMemberEmailVerificationChallengeRepository(
    async (name: string, parameters: Record<string, unknown>) => {
      calls.push({ name, parameters });
      if (name === "reserve_member_email_verification_challenge") {
        return {
          data: [
            {
              challenge_id: "00000000-0000-4000-8000-000000000402",
              accepted: true,
              retry_after_seconds: 0,
            },
          ],
          error: null,
        };
      }
      return { data: true, error: null };
    },
  );

  assert.deepEqual(
    await repository.reserve({
      memberId: "00000000-0000-4000-8000-000000000401",
      emailNormalized: "member@example.com",
      codeHash: "a".repeat(64),
      expiresAt: "2026-08-23T06:00:00.000Z",
      resendAvailableAt: "2026-08-23T05:51:00.000Z",
    }),
    {
      accepted: true,
      challengeId: "00000000-0000-4000-8000-000000000402",
      retryAfterSeconds: 0,
    },
  );
  await repository.markSent("00000000-0000-4000-8000-000000000402");
  await repository.deletePending("00000000-0000-4000-8000-000000000402");
  assert.deepEqual(
    calls.map((call) => call.name),
    [
      "reserve_member_email_verification_challenge",
      "mark_member_email_verification_challenge_sent",
      "delete_pending_member_email_verification_challenge",
    ],
  );

  const providerDetail = "secret-db-host member@example.com";
  const failureRepository =
    new SupabaseMemberEmailVerificationChallengeRepository(async () => ({
      data: null,
      error: { message: providerDetail },
    }));
  await assert.rejects(
    failureRepository.reserve({
      memberId: "00000000-0000-4000-8000-000000000401",
      emailNormalized: "member@example.com",
      codeHash: "a".repeat(64),
      expiresAt: "2026-08-23T06:00:00.000Z",
      resendAvailableAt: "2026-08-23T05:51:00.000Z",
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, MemberEmailChallengeStorageError.name);
      assert.equal(error.message, "member_email_challenge_storage_failed");
      assert.doesNotMatch(
        JSON.stringify(error),
        /secret-db-host|member@example\.com/,
      );
      return true;
    },
  );
});

test("설정 화면은 이메일 폼 대신 별도 흐름으로 이동하는 요약 설정 행만 제공한다", () => {
  const certificationPage = read("src/app/(site)/certification/page.tsx");
  const settingsPage = read("src/app/(site)/settings/page.tsx");
  const settingsView = read("src/components/settings/MemberSettingsView.tsx");
  const accountSettings = read(
    "src/components/certification/CertificationAccountSettings.tsx",
  );
  const mattermostSync = read(
    "src/components/certification/CertificationMattermostSyncAction.tsx",
  );
  const footerActions = read(
    "src/components/certification/CertificationFooterActions.tsx",
  );
  const emailPage = read("src/app/(site)/certification/email/page.tsx");
  const summary = read(
    "src/components/certification/CertificationEmailSummary.tsx",
  );

  assert.doesNotMatch(certificationPage, /CertificationAccountSettings/);
  assert.match(settingsPage, /MemberSettingsView/);
  assert.match(settingsView, /CertificationAccountSettings/);
  assert.match(accountSettings, /CertificationEmailSummary/);
  assert.doesNotMatch(certificationPage, /CertificationEmailAction/);
  assert.match(summary, /로그인·복구 이메일/);
  assert.match(summary, /\/certification\/email/);
  assert.doesNotMatch(
    summary,
    /MM 사용이 어려울 때 로그인과 비밀번호 재설정에 사용할 수 있습니다\./,
  );
  assert.match(summary, /emailVerified && email\s*\? email/);
  assert.match(
    mattermostSync,
    /MM에서 현재 이름, 아이디, 트랙, 프로필 사진을 가져옵니다\./,
  );
  assert.match(footerActions, /현재 계정의 비밀번호를 변경합니다\./);
  assert.match(emailPage, /MemberEmailVerificationView/);
  assert.match(emailPage, /sanitizeReturnTo/);
  assert.match(emailPage, /로그인·복구 이메일/);
});

test("로그인·복구 이메일 화면은 간결한 헤더와 전용 로딩 골격을 제공한다", () => {
  const emailPage = read("src/app/(site)/certification/email/page.tsx");
  const emailView = read(
    "src/components/certification/MemberEmailVerificationView.tsx",
  );
  const emailLoading = read("src/app/(site)/certification/email/loading.tsx");
  const skeletons = read("src/components/loading/SitePageSkeletons.tsx");
  const story = read(
    "src/components/certification/MemberEmailVerificationView.stories.tsx",
  );

  assert.doesNotMatch(emailPage, /eyebrow="Member"/);
  assert.match(
    emailPage,
    /로그인과 비밀번호 재설정에 사용할 이메일을 인증합니다\./,
  );
  assert.doesNotMatch(emailPage, /MM 사용 여부와 별개로/);
  assert.match(emailPage, /className="border-b-0"/);
  assert.doesNotMatch(emailView, /title="별도 로그인 수단"/);
  assert.doesNotMatch(emailView, /MM 인증과 이메일 인증은 서로를 대체하는/);
  assert.doesNotMatch(
    emailView,
    /인증을 마친 이메일은 로그인과 비밀번호 재설정에 사용됩니다\./,
  );
  assert.match(emailLoading, /MemberEmailVerificationPageSkeleton/);
  assert.doesNotMatch(emailLoading, /CertificationPageSkeleton/);
  assert.match(
    skeletons,
    /export function MemberEmailVerificationPageSkeleton\(\)/,
  );
  assert.doesNotMatch(story, /eyebrow="Member"/);
  assert.match(
    story,
    /로그인과 비밀번호 재설정에 사용할 이메일을 인증합니다\./,
  );
});

test("별도 이메일 인증 화면은 전송 후 이메일 고정·만료 타이머·입력행 재전송을 제공한다", () => {
  const view = read(
    "src/components/certification/MemberEmailVerificationView.tsx",
  );

  assert.match(view, /lockedEmail/);
  assert.match(view, /role="timer"/);
  assert.match(view, /formatMemberEmailRemainingTime/);
  assert.match(view, /인증 코드 유효시간/);
  assert.match(view, /const currentStep = lockedEmail \? 2 : 1/);
  assert.match(view, /aria-label=\{`인증 단계 \$\{currentStep\}\/2`\}/);
  assert.match(view, /step <= currentStep \? "bg-primary" : "bg-border"/);
  assert.match(view, /변경할 이메일을 입력해 주세요/);
  assert.match(view, /const hasValidEmail = isValidEmail\(email\.trim\(\)\.toLowerCase\(\)\)/);
  assert.match(view, /resendRemainingSeconds > 0 \|\| !hasValidEmail/);
  assert.match(view, /재전송 \$\{resendRemainingSeconds\}초/);
  assert.doesNotMatch(
    view,
    /코드를 보낸 이메일은 인증이 끝날 때까지 고정됩니다\./,
  );
  assert.match(view, /ariaLabel="다른 이메일 입력"/);
  assert.match(view, /<Pencil aria-hidden="true" size=\{18\} \/>/);
  assert.match(
    view,
    /const hasCompleteCode = \/\^\\d\{6\}\$\/\.test\(code\)/,
  );
  assert.match(view, /codeRemainingSeconds === 0 \|\| !hasCompleteCode/);
  assert.match(view, /codeRemainingSeconds === 0/);
  assert.match(view, /resendRemainingSeconds > 0/);
  assert.match(view, /router\.replace\(completionHref\)/);
});

test("새 이메일 인증 경로가 경로·상태·Storybook 인벤토리에 등록된다", () => {
  const routeInventory = read("src/lib/mock/scenarios/route-inventory.ts");
  const requiredStates = read("src/lib/mock/scenarios/required-states.ts");
  const storybookCoverage = read(
    "src/lib/mock/scenarios/storybook-coverage.ts",
  );

  assert.match(
    routeInventory,
    /routePath:\s*"\/certification\/email"[\s\S]+viewComponent:\s*"MemberEmailVerificationView"/,
  );
  assert.match(requiredStates, /"\/certification\/email":\s*\[/);
  assert.match(
    storybookCoverage,
    /routePath:\s*"\/certification\/email"[\s\S]+actualViewComponent:\s*"MemberEmailVerificationView"/,
  );
});
