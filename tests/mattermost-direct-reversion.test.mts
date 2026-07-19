import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

function read(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("SSAFY Verify runtime, routes, and public environment keys are removed", () => {
  const removedPaths = [
    "src/app/api/ssafy/verify-token/route.ts",
    "src/app/api/ssafy/signup/route.ts",
    "src/app/api/ssafy/reset-password/route.ts",
    "src/app/auth/ssafy/page.tsx",
    "src/components/auth/SsafyVerifyButton.tsx",
    "src/lib/ssafy-verify/config.ts",
  ];
  for (const path of removedPaths) {
    assert.equal(existsSync(join(repoRoot, path)), false, `${path} should be removed`);
  }

  const envExample = read(".env.example");
  assert.doesNotMatch(envExample, /SSAFY_VERIFY|MM_SENDER_LOGIN_ID|MM_SENDER_PASSWORD/);
});

test("environment example excludes deprecated, local-only, and compatibility configuration", () => {
  const envExample = read(".env.example");
  const excludedKeys = [
    "ADMIN_ID",
    "ADMIN_PASSWORD",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_DATA_SOURCE",
    "NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE",
    "PREVIEW_TEST_MEMBER_USERNAME",
    "PREVIEW_TEST_MEMBER_PASSWORD",
    "DATA_GO_KR_SERVICE_KEY",
    "NAVER_SMTP_USER",
    "NAVER_SMTP_PASS",
    "SMTP_FROM_EMAIL",
    "SMTP_TLS_MIN_DH_SIZE",
    "SMTP_TLS_CIPHERS",
  ];

  for (const key of excludedKeys) {
    assert.doesNotMatch(
      envExample,
      new RegExp(`\\b${key}\\b`),
      `${key} should not be included in .env.example`,
    );
  }
});

test("direct Mattermost verification stores only challenge/code hashes and uses RLS service RPCs", () => {
  const migration = read("supabase/migrations/20260717013834_add_mattermost_verification_codes.sql");
  const service = read("src/lib/mattermost-code-verification.ts");

  assert.match(migration, /challenge_hash text not null unique/);
  assert.match(migration, /code_hash text not null/);
  assert.doesNotMatch(migration, /\bcode text\b|\bpassword text\b/i);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.mattermost_verification_codes from authenticated/);
  assert.match(migration, /grant execute on function public\.consume_mattermost_verification_code[\s\S]*to service_role/);
  assert.match(service, /createHmacDigest/);
  assert.doesNotMatch(service, /console\.(log|error)|credentials\.password/);
});

test("가입 코드 검증은 본인 인증 뒤 기존 회원을 로그인으로 분기한다", () => {
  const route = read("src/app/api/mm/code/verify/route.ts");
  const memberIdentifiers = read("src/lib/member-identifier-reservations.ts");

  assert.match(route, /hasExistingMattermostMember/);
  assert.match(route, /existingMember:\s*true/);
  assert.match(route, /nextPath:\s*"\/auth\/login"/);
  assert.match(route, /clearMattermostCodeSession/);
  assert.match(memberIdentifiers, /findMmUserDirectoryEntryByUserId/);
  assert.match(memberIdentifiers, /\.from\("members"\)/);
  assert.match(memberIdentifiers, /\.is\("deleted_at", null\)/);
});

test("sender credentials remain encrypted and browser-facing interfaces have no credential fields", () => {
  const crypto = read("src/lib/mattermost-senders/crypto.ts");
  const manager = read("src/components/admin/MattermostSenderManager.tsx");
  const senderActions = read("src/app/admin/(protected)/_actions/cycle-actions.ts");

  assert.match(crypto, /aes-256-gcm/i);
  assert.match(crypto, /authTag/);
  assert.doesNotMatch(manager, /ciphertext|nonce|authTag|MM_SENDER_CREDENTIALS_KEY/);
  assert.doesNotMatch(senderActions, /console\.(log|error)/);
});
