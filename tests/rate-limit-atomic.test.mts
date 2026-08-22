import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rateLimitModulePromise = import(
  new URL("../src/lib/rate-limit.ts", import.meta.url).href
);

const config = {
  table: "member_auth_attempts" as const,
  windowMs: 10 * 60 * 1_000,
  maxAttempts: 5,
  blockMs: 30 * 60 * 1_000,
};

type RateLimitRpcParameters = {
  p_table_name: string;
  p_identifier: string;
  p_success: boolean;
  p_window_ms: number;
  p_max_attempts: number;
  p_block_ms: number;
};

type MockAttemptState = {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number | null;
};

// This serialized model documents the application contract only. It does not
// substitute for exercising PostgreSQL's ON CONFLICT and row-lock semantics.
function createSerializedRateLimitReferenceModel(initialNow = 0) {
  const attempts = new Map<string, MockAttemptState>();
  let now = initialNow;

  const apply = (
    parameters: RateLimitRpcParameters,
    timing: { recordedAt: number; appliedAt: number },
  ) => {
    if (parameters.p_success) {
      attempts.delete(parameters.p_identifier);
      return;
    }

    const current = attempts.get(parameters.p_identifier);
    const isExpired =
      current !== undefined &&
      timing.recordedAt - current.firstAttemptAt > parameters.p_window_ms;

    if (!current || isExpired) {
      attempts.set(parameters.p_identifier, {
        count: 1,
        firstAttemptAt: timing.recordedAt,
        blockedUntil:
          parameters.p_max_attempts <= 1
            ? timing.recordedAt + parameters.p_block_ms
            : null,
      });
      return;
    }

    const count = current.count + 1;
    const candidateBlockedUntil = timing.appliedAt + parameters.p_block_ms;
    attempts.set(parameters.p_identifier, {
      count,
      firstAttemptAt: current.firstAttemptAt,
      blockedUntil:
        count >= parameters.p_max_attempts
          ? Math.max(
              current.blockedUntil ?? Number.NEGATIVE_INFINITY,
              candidateBlockedUntil,
            )
          : current.blockedUntil,
    });
  };

  const execute = async (parameters: RateLimitRpcParameters) => {
    apply(parameters, { recordedAt: now, appliedAt: now });
    return { error: null };
  };

  return {
    apply,
    execute,
    advanceTime(milliseconds: number) {
      now += milliseconds;
    },
    get(identifier: string) {
      return attempts.get(identifier) ?? null;
    },
  };
}

test("rate-limit wrapper forwards the PostgreSQL RPC contract", async () => {
  const { persistRateLimitAttempt } = await rateLimitModulePromise;
  const calls: Array<Record<string, unknown>> = [];

  const result = await persistRateLimitAttempt(
    {
      identifier: "login:account:member",
      success: false,
      config,
    },
    async (parameters: Record<string, unknown>) => {
      calls.push(parameters);
      return { error: null };
    },
  );

  assert.deepEqual(calls, [
    {
      p_table_name: "member_auth_attempts",
      p_identifier: "login:account:member",
      p_success: false,
      p_window_ms: 600_000,
      p_max_attempts: 5,
      p_block_ms: 1_800_000,
    },
  ]);
  assert.deepEqual(result, { ok: true });
});

test("serialized reference model covers count and the exact window boundary", async () => {
  const { persistRateLimitAttempt } = await rateLimitModulePromise;
  const repository = createSerializedRateLimitReferenceModel();
  const identifier = "login:account:concurrent-member";
  const recordFailure = () =>
    persistRateLimitAttempt(
      { identifier, success: false, config },
      repository.execute,
    );

  for (let index = 0; index < 25; index += 1) {
    assert.deepEqual(await recordFailure(), { ok: true });
  }

  assert.deepEqual(repository.get(identifier), {
    count: 25,
    firstAttemptAt: 0,
    blockedUntil: config.blockMs,
  });

  repository.advanceTime(config.windowMs);
  await recordFailure();
  assert.equal(repository.get(identifier)?.count, 26);

  repository.advanceTime(1);
  await recordFailure();
  assert.deepEqual(repository.get(identifier), {
    count: 1,
    firstAttemptAt: config.windowMs + 1,
    blockedUntil: null,
  });

  await persistRateLimitAttempt(
    { identifier, success: true, config },
    repository.execute,
  );
  assert.equal(repository.get(identifier), null);
});

test("out-of-order timestamps cannot shorten an active block in the reference model", () => {
  const repository = createSerializedRateLimitReferenceModel();
  const identifier = "login:account:out-of-order-member";
  const parameters: RateLimitRpcParameters = {
    p_table_name: config.table,
    p_identifier: identifier,
    p_success: false,
    p_window_ms: config.windowMs,
    p_max_attempts: config.maxAttempts,
    p_block_ms: config.blockMs,
  };

  for (let count = 0; count < config.maxAttempts - 1; count += 1) {
    repository.apply(parameters, { recordedAt: 0, appliedAt: 0 });
  }

  repository.apply(parameters, { recordedAt: 200, appliedAt: 200 });
  const firstBlockedUntil = repository.get(identifier)?.blockedUntil;

  repository.apply(parameters, { recordedAt: 100, appliedAt: 300 });
  assert.equal(firstBlockedUntil, 200 + config.blockMs);
  assert.equal(repository.get(identifier)?.blockedUntil, 300 + config.blockMs);
});

test("rate-limit persistence returns safe typed failures without provider details", async () => {
  const { persistRateLimitAttempt } = await rateLimitModulePromise;

  const providerErrorResult = await persistRateLimitAttempt(
    {
      identifier: "login:account:member",
      success: false,
      config,
    },
    async () => ({ error: { message: "sensitive database response" } }),
  );
  assert.deepEqual(providerErrorResult, {
    ok: false,
    code: "rate_limit_storage_failed",
  });
  assert.doesNotMatch(
    JSON.stringify(providerErrorResult),
    /sensitive database response/,
  );

  const rejectedResult = await persistRateLimitAttempt(
    {
      identifier: "login:account:member",
      success: false,
      config,
    },
    async () => {
      throw new TypeError("fetch failed with internal connection details");
    },
  );
  assert.deepEqual(rejectedResult, {
    ok: false,
    code: "rate_limit_storage_failed",
  });
  assert.doesNotMatch(
    JSON.stringify(rejectedResult),
    /fetch failed|connection details/,
  );
});

test("storage failures do not divert post-side-effect callers into catch paths", async () => {
  const { persistRateLimitAttempt } = await rateLimitModulePromise;
  const events = ["business_side_effect_completed"];

  try {
    const result = await persistRateLimitAttempt(
      {
        identifier: "login:account:member",
        success: true,
        config,
      },
      async () => ({ error: { message: "provider cleanup failed" } }),
    );
    assert.deepEqual(result, {
      ok: false,
      code: "rate_limit_storage_failed",
    });
    events.push("caller_continued");
  } catch {
    events.push("catch_entered");
  }

  assert.deepEqual(events, [
    "business_side_effect_completed",
    "caller_continued",
  ]);
});

test("recordAttempt normalizes synchronous Supabase client setup failures", async () => {
  const { recordAttempt } = await rateLimitModulePromise;
  const previousUrl = process.env.SUPABASE_URL;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.deepEqual(
      await recordAttempt("login:account:member", true, config),
      {
        ok: false,
        code: "rate_limit_storage_failed",
      },
    );
  } finally {
    if (previousUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = previousUrl;
    }
    if (previousServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
    }
  }
});

test("rate-limit batches deduplicate identifiers and aggregate safe failures", async () => {
  const { recordAttemptBatch } = await rateLimitModulePromise;
  const calls: string[] = [];

  const result = await recordAttemptBatch(
    [
      "login:ip:127.0.0.1",
      "login:account:member",
      "login:ip:127.0.0.1",
      "login:ip:storage-error",
      "",
    ],
    false,
    config,
    {
      recordAttempt: async (identifier: string) => {
        calls.push(identifier);
        if (identifier.endsWith(":storage-error")) {
          throw new TypeError("provider batch failure detail");
        }
        return identifier.includes(":account:")
          ? { ok: false, code: "rate_limit_storage_failed" as const }
          : { ok: true };
      },
    },
  );

  assert.deepEqual(calls, [
    "login:ip:127.0.0.1",
    "login:account:member",
    "login:ip:storage-error",
  ]);
  assert.deepEqual(result, {
    ok: false,
    code: "rate_limit_storage_failed",
    attemptedCount: 3,
    failedCount: 2,
  });
  assert.doesNotMatch(JSON.stringify(result), /provider batch failure detail/);

  assert.deepEqual(
    await recordAttemptBatch([], false, config, {
      recordAttempt: async () => ({ ok: true }),
    }),
    { ok: true, attemptedCount: 0, failedCount: 0 },
  );
});

test("rate-limit migration declares the allowlisted PostgreSQL upsert contract", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260813010819_record_rate_limit_attempt_atomically.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const schema = await readFile(
    new URL("../supabase/schema.sql", import.meta.url),
    "utf8",
  );
  const source = await readFile(
    new URL("../src/lib/rate-limit.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    migration,
    /create or replace function public\.record_rate_limit_attempt\(/,
  );
  assert.match(migration, /security definer\s+set search_path = public/);
  assert.match(migration, /on conflict \(identifier\) do update/);
  assert.match(migration, /attempt\.count \+ 1/);
  assert.match(
    migration,
    /greatest\([\s\S]+attempt\.blocked_until[\s\S]+pg_catalog\.clock_timestamp\(\)/,
  );
  assert.match(migration, /delete from public\.%I where identifier = \$1/);
  assert.match(migration, /p_table_name is null or p_table_name not in \(/);

  for (const table of [
    "admin_login_attempts",
    "member_auth_attempts",
    "mattermost_sender_test_attempts",
    "partner_auth_attempts",
    "partner_registration_attempts",
    "suggestion_attempts",
  ]) {
    assert.match(migration, new RegExp(`'${table}'`));
    const tableDefinition = schema.match(
      new RegExp(
        `create table if not exists (?:public\\.)?${table}\\s*\\(([\\s\\S]*?)\\n\\);`,
        "i",
      ),
    )?.[1];
    assert.ok(tableDefinition, `${table} must exist in the schema snapshot`);
    assert.match(tableDefinition, /identifier text not null unique/i);
    assert.match(tableDefinition, /count integer not null default 0/i);
    assert.match(
      tableDefinition,
      /first_attempt_at timestamp with time zone not null default now\(\)/i,
    );
    assert.match(tableDefinition, /blocked_until timestamp with time zone/i);
  }

  assert.match(
    migration,
    /revoke all on function public\.record_rate_limit_attempt\([^)]+\) from public/,
  );
  assert.match(
    migration,
    /revoke all on function public\.record_rate_limit_attempt\([^)]+\) from anon/,
  );
  assert.match(
    migration,
    /revoke all on function public\.record_rate_limit_attempt\([^)]+\) from authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.record_rate_limit_attempt\([^)]+\) to service_role/,
  );
  assert.ok(schema.includes(migration.trim()));
  assert.doesNotMatch(
    source,
    /select\("id,count,first_attempt_at,blocked_until"\)/,
  );
});
