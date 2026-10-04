import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { adminActionErrorMessages } from "../src/lib/admin-action-errors.ts";

const setupLinkModulePromise = import(
  new URL(
    "../src/app/admin/(protected)/_actions/partner-support/setup-link.ts",
    import.meta.url,
  ).href
);

type FakeResult = { data?: unknown; error?: { message: string } | null };

function createFakeSupabase({
  account,
  lookupError = null,
  updateError = null,
}: {
  account?: Record<string, unknown> | null;
  lookupError?: { message: string } | null;
  updateError?: { message: string } | null;
}) {
  const updates: Array<{ payload: Record<string, unknown>; id: unknown }> = [];
  const client = {
    from(table: string) {
      assert.equal(table, "partner_accounts");
      let payload: Record<string, unknown> | null = null;
      const builder = {
        select() {
          return builder;
        },
        update(nextPayload: Record<string, unknown>) {
          payload = nextPayload;
          return builder;
        },
        eq(column: string, value: unknown): unknown {
          if (payload) {
            updates.push({ payload, id: value });
            return Promise.resolve({ data: null, error: updateError } satisfies FakeResult);
          }
          assert.equal(column, "id");
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({
            data: lookupError ? null : (account ?? null),
            error: lookupError,
          } satisfies FakeResult);
        },
      };
      return builder;
    },
  };
  return { client, updates };
}

function buildAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "account-1",
    login_id: "partner@example.com",
    display_name: "담당자",
    email: "partner@example.com",
    is_active: true,
    initial_setup_completed_at: null,
    ...overrides,
  };
}

async function issueWith(options: Parameters<typeof createFakeSupabase>[0]) {
  const { issuePartnerAccountInitialSetupLink } = await setupLinkModulePromise;
  const fake = createFakeSupabase(options);
  return {
    fake,
    run: () =>
      issuePartnerAccountInitialSetupLink(fake.client as never, "account-1"),
  };
}

test("초기설정 URL 발급 실패는 운영자가 조치할 수 있는 관리자 오류 코드로 구분한다", async () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    for (const [options, code] of [
      [{ account: null }, "partner_account_missing_id"],
      [{ account: buildAccount({ is_active: false }) }, "partner_account_inactive"],
      [
        { account: buildAccount({ initial_setup_completed_at: "2026-10-01T00:00:00.000Z" }) },
        "partner_account_setup_completed",
      ],
      [{ account: buildAccount({ email: "not-an-email" }) }, "partner_account_invalid_email"],
      [{ lookupError: { message: "permission denied" } }, "partner_account_setup_link_failed"],
      [
        { account: buildAccount(), updateError: { message: "column does not exist" } },
        "partner_account_setup_link_failed",
      ],
    ] as const) {
      const { run } = await issueWith(options);
      await assert.rejects(run(), (error: unknown) => (error as Error).message === code, code);
      assert.ok(adminActionErrorMessages[code], `${code} must have an operator message`);
    }
  } finally {
    console.error = originalConsoleError;
  }
});

test("초기설정 URL 발급은 hash·만료만 저장하고 평문 토큰 컬럼을 쓰지 않는다", async () => {
  const { fake, run } = await issueWith({ account: buildAccount() });
  const before = Date.now();
  const issued = await run();

  assert.equal(fake.updates.length, 1);
  const [{ payload, id }] = fake.updates;
  assert.equal(id, "account-1");
  const token = new URL(issued.setupUrl).pathname.split("/").at(-1) ?? "";
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(payload.initial_setup_token_hash, createHash("sha256").update(token).digest("hex"));
  assert.equal(payload.initial_setup_expires_at, issued.expiresAt);
  assert.equal("initial_setup_token" in payload, false);
  assert.equal(payload.must_change_password, true);
  const ttlMs = new Date(issued.expiresAt).getTime() - before;
  assert.ok(ttlMs > 6.9 * 24 * 60 * 60 * 1000 && ttlMs <= 7 * 24 * 60 * 60 * 1000 + 1000);
});

test("초기설정 URL 메일 발송 실패는 입력 오류가 아니라 발송 실패로 안내한다", () => {
  const source = readFileSync(
    new URL("../src/app/admin/(protected)/_actions/account-actions.setup.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /partner_account_invalid_request/);
  assert.match(
    source,
    /sendPartnerPortalInitialSetupEmail\([\s\S]*?\} catch \(error\) \{[\s\S]*?"partner_account_setup_email_failed"/,
  );
  assert.match(source, /getSafeAdminActionErrorCode\(error, "partner_account_setup_link_failed"\)/);
  assert.match(adminActionErrorMessages.partner_account_setup_email_failed, /메일을 보내지 못했습니다/);
});
