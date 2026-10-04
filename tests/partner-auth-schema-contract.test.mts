import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as nodeModule from "node:module";
import test from "node:test";

/**
 * Partner auth reads/writes run against the forward-only schema: the hashed
 * initial setup columns and `partner_accounts.auth_session_version` always
 * exist. These behavior tests pin that a schema error is surfaced after one
 * attempt (never retried with a reduced column set), an unknown setup token
 * resolves to null, and setup completion clears the token hash and expiry.
 */

type ResolveResult = { shortCircuit?: boolean; url: string };
type NextResolve = (specifier: string, context: unknown) => ResolveResult;

const { registerHooks } = nodeModule as unknown as {
  registerHooks(hooks: {
    resolve: (
      specifier: string,
      context: unknown,
      nextResolve: NextResolve,
    ) => ResolveResult;
  }): void;
};

const supabaseModule = `export function getSupabaseAdminClient() {
  return globalThis.__partnerAuthSchemaSupabase;
}`;

const mockModules = new Map<string, string>([
  ["../supabase/server.ts", supabaseModule],
  ["./supabase/server.ts", supabaseModule],
  ["@/lib/supabase/server", supabaseModule],
  [
    "../partner-email.ts",
    `export async function sendPartnerPortalTemporaryPasswordEmail(input) {
      return globalThis.__partnerAuthSchemaSendEmail(input);
    }`,
  ],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const source = mockModules.get(specifier);
    if (source !== undefined) {
      return {
        shortCircuit: true,
        url: `data:text/javascript,${encodeURIComponent(source)}`,
      };
    }
    return nextResolve(specifier, context);
  },
});

process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE = "supabase";
process.env.SUPABASE_URL ??= "https://supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

type QueryOperation = "select" | "update";
type QueryFilter = { kind: "eq" | "is" | "in"; column: string; value: unknown };
type QueryCall = {
  table: string;
  operation: QueryOperation;
  columns: string | null;
  payload?: Record<string, unknown>;
  filters: QueryFilter[];
};
type QueryResult = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
};
type QueryHandler = (call: QueryCall) => QueryResult;

class FakeQuery {
  private readonly call: QueryCall;
  private readonly handler: QueryHandler;
  private readonly calls: QueryCall[];

  constructor(table: string, handler: QueryHandler, calls: QueryCall[]) {
    this.call = { table, operation: "select", columns: null, filters: [] };
    this.handler = handler;
    this.calls = calls;
  }

  select(columns?: string) {
    if (this.call.operation === "select" || columns) {
      this.call.columns = columns ?? null;
    }
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.call.operation = "update";
    this.call.payload = payload;
    return this;
  }

  eq(column: string, value: unknown) {
    this.call.filters.push({ kind: "eq", column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.call.filters.push({ kind: "is", column, value });
    return this;
  }

  in(column: string, value: unknown) {
    this.call.filters.push({ kind: "in", column, value });
    return this;
  }

  order() {
    return this;
  }

  maybeSingle() {
    return this.execute();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private execute() {
    const snapshot = { ...this.call, filters: [...this.call.filters] };
    this.calls.push(snapshot);
    const result = this.handler(snapshot);
    return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
  }
}

function installSupabase(handler: QueryHandler) {
  const calls: QueryCall[] = [];
  (globalThis as Record<string, unknown>).__partnerAuthSchemaSupabase = {
    from(table: string) {
      return new FakeQuery(table, handler, calls);
    },
  };
  return calls;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function filterValue(call: QueryCall, kind: QueryFilter["kind"], column: string) {
  return call.filters.find((filter) => filter.kind === kind && filter.column === column)
    ?.value;
}

const missingSetupColumnError = {
  message:
    "Could not find the 'initial_setup_expires_at' column of 'partner_accounts' in the schema cache",
  code: "PGRST204",
};
const missingVersionColumnError = {
  message: "column partner_accounts.auth_session_version does not exist",
  code: "42703",
};

const FUTURE = "2999-01-01T00:00:00.000Z";
const PAST = "2000-01-01T00:00:00.000Z";

function buildSetupAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "account-1",
    login_id: "partner@example.com",
    display_name: "담당자",
    email: "partner@example.com",
    password_hash: null,
    password_salt: null,
    must_change_password: true,
    is_active: true,
    email_verified_at: null,
    initial_setup_completed_at: null,
    updated_at: "2026-10-01T00:00:00.000Z",
    auth_session_version: 3,
    initial_setup_token_hash: sha256("setup-token"),
    initial_setup_link_sent_at: null,
    initial_setup_expires_at: FUTURE,
    ...overrides,
  };
}

const accountsModulePromise = import("../src/lib/partner-auth/accounts.ts");
const setupModulePromise = import("../src/lib/partner-auth/setup.ts");
const passwordModulePromise = import("../src/lib/partner-auth/password.ts");
const resetModulePromise = import("../src/lib/partner-auth/reset.ts");
const sessionAccessModulePromise = import("../src/lib/partner-session-access.ts");

test("초기 설정 토큰은 hash 컬럼 단일 조회로 찾고, 모르는 토큰은 null이다", async () => {
  const { findSupabasePartnerPortalSetupAccount, PARTNER_SETUP_ACCOUNT_SELECT } =
    await accountsModulePromise;
  const calls = installSupabase(() => ({ data: null }));

  assert.equal(await findSupabasePartnerPortalSetupAccount("unknown-token"), null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, "partner_accounts");
  assert.equal(calls[0].columns, PARTNER_SETUP_ACCOUNT_SELECT);
  assert.deepEqual(calls[0].filters, [
    { kind: "eq", column: "initial_setup_token_hash", value: sha256("unknown-token") },
  ]);

  const columns = PARTNER_SETUP_ACCOUNT_SELECT.split(",");
  for (const column of [
    "initial_setup_token_hash",
    "initial_setup_expires_at",
    "initial_setup_link_sent_at",
    "auth_session_version",
  ]) {
    assert.ok(columns.includes(column), column);
  }
  assert.equal(columns.includes("initial_setup_token"), false);

  assert.equal(await findSupabasePartnerPortalSetupAccount(""), null);
  assert.equal(calls.length, 1, "빈 토큰은 조회하지 않는다");
});

test("초기 설정 조회의 스키마 오류는 다른 컬럼 조합으로 재시도하지 않고 즉시 throw한다", async () => {
  const { findSupabasePartnerPortalSetupAccount } = await accountsModulePromise;
  const { getSupabasePartnerPortalSetupContext } = await setupModulePromise;
  const calls = installSupabase(() => ({ error: missingSetupColumnError }));

  await assert.rejects(
    findSupabasePartnerPortalSetupAccount("setup-token"),
    (error: unknown) => (error as { code?: string }).code === "PGRST204",
  );
  assert.equal(calls.length, 1);

  await assert.rejects(getSupabasePartnerPortalSetupContext("setup-token"));
  assert.equal(calls.length, 2);
});

test("만료 시각이 없거나 지난 초기 설정 링크는 발송 시각으로 보정하지 않고 무효로 본다", async () => {
  const { getSupabasePartnerPortalSetupContext, completeSupabasePartnerPortalInitialSetup } =
    await setupModulePromise;

  for (const expiresAt of [null, PAST]) {
    const calls = installSupabase((call) =>
      call.table === "partner_accounts"
        ? {
            data: buildSetupAccount({
              initial_setup_expires_at: expiresAt,
              initial_setup_link_sent_at: new Date().toISOString(),
            }),
          }
        : { data: [] },
    );
    assert.equal(await getSupabasePartnerPortalSetupContext("setup-token"), null);
    await assert.rejects(
      completeSupabasePartnerPortalInitialSetup({
        token: "setup-token",
        password: "Valid-password1!",
        confirmPassword: "Valid-password1!",
      }),
      (error: unknown) => (error as { code?: string }).code === "not_found",
    );
    assert.equal(
      calls.some((call) => call.operation === "update"),
      false,
    );
  }
});

test("초기 설정 완료는 hash·만료를 비우고 세션 버전을 올리는 단일 CAS 갱신이다", async () => {
  const { completeSupabasePartnerPortalInitialSetup } = await setupModulePromise;
  const calls = installSupabase((call) => {
    if (call.table === "partner_account_companies") {
      return { data: [{ company_id: "company-1", is_active: true }] };
    }
    if (call.operation === "update") {
      return { data: { id: "account-1" } };
    }
    return { data: buildSetupAccount() };
  });

  const result = await completeSupabasePartnerPortalInitialSetup({
    token: "setup-token",
    password: "Valid-password1!",
    confirmPassword: "Valid-password1!",
  });

  assert.equal(result.accountId, "account-1");
  assert.equal(result.companyId, "company-1");
  const updates = calls.filter((call) => call.operation === "update");
  assert.equal(updates.length, 1);
  const [update] = updates;
  assert.equal(update.payload?.initial_setup_token_hash, null);
  assert.equal(update.payload?.initial_setup_expires_at, null);
  assert.equal(update.payload?.auth_session_version, 4);
  assert.equal(update.payload?.must_change_password, false);
  assert.equal("initial_setup_token" in (update.payload ?? {}), false);
  assert.equal(filterValue(update, "eq", "id"), "account-1");
  assert.equal(filterValue(update, "is", "initial_setup_completed_at"), null);
  assert.equal(filterValue(update, "eq", "initial_setup_token_hash"), sha256("setup-token"));
});

test("초기 설정 완료 갱신의 스키마 오류는 payload를 바꿔 재시도하지 않는다", async () => {
  const { completeSupabasePartnerPortalInitialSetup } = await setupModulePromise;
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    const calls = installSupabase((call) => {
      if (call.table === "partner_account_companies") {
        return { data: [{ company_id: "company-1", is_active: true }] };
      }
      if (call.operation === "update") {
        return { error: missingVersionColumnError };
      }
      return { data: buildSetupAccount() };
    });

    await assert.rejects(
      completeSupabasePartnerPortalInitialSetup({
        token: "setup-token",
        password: "Valid-password1!",
        confirmPassword: "Valid-password1!",
      }),
      (error: unknown) => (error as { code?: string }).code === "42703",
    );
    assert.equal(calls.filter((call) => call.operation === "update").length, 1);
  } finally {
    console.error = originalConsoleError;
  }
});

test("세션 버전 컬럼 오류는 계정 조회에서 축소 select로 재시도하지 않는다", async () => {
  const { getSupabasePartnerPortalAccountById, findSupabasePartnerPortalAccount, PARTNER_ACCOUNT_SELECT } =
    await accountsModulePromise;
  const calls = installSupabase(() => ({ error: missingVersionColumnError }));

  await assert.rejects(getSupabasePartnerPortalAccountById("account-1"));
  await assert.rejects(findSupabasePartnerPortalAccount("partner@example.com"));
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.columns === PARTNER_ACCOUNT_SELECT));
  assert.ok(PARTNER_ACCOUNT_SELECT.split(",").includes("auth_session_version"));
});

test("비밀번호 변경은 세션 버전을 함께 올리고 DB 오류를 그대로 전파한다", async () => {
  const { hashPassword } = await import("../src/lib/password.ts");
  const { changeSupabasePartnerPortalPassword } = await passwordModulePromise;
  const record = hashPassword("Current-password1!");
  const account = buildSetupAccount({
    password_hash: record.hash,
    password_salt: record.salt,
    initial_setup_completed_at: "2026-10-01T00:00:00.000Z",
    must_change_password: true,
    auth_session_version: 5,
  });

  const calls = installSupabase((call) =>
    call.operation === "update" ? { error: missingVersionColumnError } : { data: account },
  );
  await assert.rejects(
    changeSupabasePartnerPortalPassword({
      accountId: "account-1",
      currentPassword: "Current-password1!",
      nextPassword: "Next-password2@",
    }),
    (error: unknown) => (error as { code?: string }).code === "42703",
  );
  const updates = calls.filter((call) => call.operation === "update");
  assert.equal(updates.length, 1);
  assert.equal(updates[0].payload?.auth_session_version, 6);
  assert.equal(filterValue(updates[0], "eq", "updated_at"), account.updated_at);
});

test("임시 비밀번호 발급은 세션 버전 컬럼 없이 커밋을 재시도하지 않고 롤백도 버전을 가드한다", async () => {
  const {
    commitSupabasePartnerPortalPasswordReset,
    prepareSupabasePartnerPortalPasswordReset,
    rollbackSupabasePartnerPortalPasswordReset,
  } = await resetModulePromise;
  const account = buildSetupAccount({
    initial_setup_completed_at: "2026-10-01T00:00:00.000Z",
    must_change_password: false,
    auth_session_version: 2,
  });
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    const failingCalls = installSupabase((call) =>
      call.operation === "update" ? { error: missingVersionColumnError } : { data: account },
    );
    const prepared = await prepareSupabasePartnerPortalPasswordReset("partner@example.com");
    await assert.rejects(
      commitSupabasePartnerPortalPasswordReset(prepared),
      (error: unknown) => (error as { code?: string }).code === "send_failed",
    );
    assert.equal(failingCalls.filter((call) => call.operation === "update").length, 1);

    const calls = installSupabase((call) =>
      call.operation === "update" ? { data: { id: "account-1" } } : { data: account },
    );
    const committed = await commitSupabasePartnerPortalPasswordReset(prepared);
    assert.equal(committed.committedAuthSessionVersion, 3);
    assert.equal("usedAuthSessionVersion" in committed, false);
    assert.equal(await rollbackSupabasePartnerPortalPasswordReset(committed), true);

    const [commit, rollback] = calls.filter((call) => call.operation === "update");
    assert.equal(commit.payload?.auth_session_version, 3);
    assert.equal(rollback.payload?.auth_session_version, 2);
    assert.equal(filterValue(rollback, "eq", "auth_session_version"), 3);
    assert.equal(filterValue(rollback, "eq", "updated_at"), committed.committedAt);
  } finally {
    console.error = originalConsoleError;
  }
});

test("세션 접근 재검증은 버전 컬럼 오류를 축소 select로 삼키지 않고 세션을 무효화한다", async () => {
  const { loadCurrentPartnerSessionAccess, revalidatePartnerSessionAccess } =
    await sessionAccessModulePromise;
  const calls = installSupabase((call) =>
    call.table === "partner_accounts"
      ? { error: missingVersionColumnError }
      : { data: [{ company_id: "company-1", company: { id: "company-1", is_active: true } }] },
  );

  await assert.rejects(loadCurrentPartnerSessionAccess("account-1"));
  assert.equal(
    calls.filter((call) => call.table === "partner_accounts").length,
    1,
  );

  const session = await revalidatePartnerSessionAccess({
    accountId: "account-1",
    loginId: "partner@example.com",
    displayName: "담당자",
    companyIds: ["company-1"],
    authSessionVersion: 1,
    mustChangePassword: false,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  });
  assert.equal(session, null);
  assert.equal(
    calls.filter((call) => call.table === "partner_accounts").length,
    2,
  );
});
