import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type RateLimitAttemptTable =
  | "admin_login_attempts"
  | "member_auth_attempts"
  | "mattermost_sender_test_attempts"
  | "partner_auth_attempts"
  | "partner_registration_attempts"
  | "suggestion_attempts";

export type RateLimitConfig = {
  table: RateLimitAttemptTable;
  windowMs: number;
  maxAttempts: number;
  blockMs: number;
};

type RecordRateLimitAttemptParameters = {
  p_table_name: RateLimitAttemptTable;
  p_identifier: string;
  p_success: boolean;
  p_window_ms: number;
  p_max_attempts: number;
  p_block_ms: number;
};

type RecordRateLimitAttemptRpc = (
  parameters: RecordRateLimitAttemptParameters,
) => PromiseLike<{ error: unknown }>;

type RateLimitAttemptRecorder = (
  identifier: string,
  success: boolean,
  config: RateLimitConfig,
) => PromiseLike<RateLimitStorageResult>;

type RateLimitBlockingStateReader = () => PromiseLike<{
  data: unknown;
  error: unknown;
}>;

export type RateLimitStorageFailure = {
  readonly ok: false;
  readonly code: "rate_limit_storage_failed";
};

export type RateLimitStorageResult =
  | { readonly ok: true }
  | RateLimitStorageFailure;

export type RateLimitBlockingStateResult =
  | {
      readonly ok: true;
      readonly blocked: false;
    }
  | {
      readonly ok: true;
      readonly blocked: true;
      readonly identifier: string;
      readonly blockedUntil: string;
    }
  | RateLimitStorageFailure;

export type RateLimitBatchStorageResult =
  | {
      readonly ok: true;
      readonly attemptedCount: number;
      readonly failedCount: 0;
    }
  | {
      readonly ok: false;
      readonly code: "rate_limit_storage_failed";
      readonly attemptedCount: number;
      readonly failedCount: number;
    };

function rateLimitStorageFailure(): RateLimitStorageFailure {
  return { ok: false, code: "rate_limit_storage_failed" };
}

export type RateLimitAttemptScope = "ip" | "account";

export function buildScopedRateLimitKey(
  route: string,
  scope: RateLimitAttemptScope,
  value: string,
  normalize: (value: string) => string = (input) => input.trim().toLowerCase(),
) {
  return `${route}:${scope}:${normalize(value)}`;
}

export function getScopedRateLimitKeys(
  route: string,
  {
    ipAddress,
    accountIdentifier,
    normalize,
  }: {
    ipAddress?: string | null;
    accountIdentifier?: string | null;
    normalize?: (value: string) => string;
  },
) {
  const keys = [
    ipAddress
      ? buildScopedRateLimitKey(route, "ip", ipAddress, normalize)
      : null,
    accountIdentifier
      ? buildScopedRateLimitKey(route, "account", accountIdentifier, normalize)
      : null,
  ];

  return [...new Set(keys.filter((key): key is string => Boolean(key)))];
}

export function getRateLimitAttemptScope(identifier: string): RateLimitAttemptScope {
  return identifier.includes(":account:") ? "account" : "ip";
}

export function getScopedRateLimitCleanupKeys(
  identifiers: Array<string | null | undefined>,
  routes: readonly string[],
  normalize: (value: string) => string = (input) => input.trim().toLowerCase(),
) {
  const uniqueIdentifiers = [
    ...new Set(
      identifiers
        .filter((identifier): identifier is string => Boolean(identifier))
        .map(normalize),
    ),
  ];

  return uniqueIdentifiers.flatMap((identifier) =>
    routes.map((route) =>
      buildScopedRateLimitKey(route, "account", identifier, (value) => value),
    ),
  );
}

const ADMIN_RATE_LIMIT: RateLimitConfig = {
  table: "admin_login_attempts",
  windowMs: 10 * 60 * 1000,
  maxAttempts: 5,
  blockMs: 15 * 60 * 1000,
};

export const ADMIN_ACCOUNT_RATE_LIMIT: RateLimitConfig = {
  table: "admin_login_attempts",
  windowMs: 10 * 60 * 1000,
  maxAttempts: 3,
  blockMs: 30 * 60 * 1000,
};

export async function isBlocked(
  identifier: string,
  config: RateLimitConfig = ADMIN_RATE_LIMIT,
): Promise<RateLimitBlockingStateResult> {
  return getBlockingState([identifier], config);
}

export async function persistRateLimitAttempt(
  input: {
    identifier: string;
    success: boolean;
    config: RateLimitConfig;
  },
  executeRpc: RecordRateLimitAttemptRpc,
): Promise<RateLimitStorageResult> {
  let error: unknown;

  try {
    ({ error } = await executeRpc({
      p_table_name: input.config.table,
      p_identifier: input.identifier,
      p_success: input.success,
      p_window_ms: input.config.windowMs,
      p_max_attempts: input.config.maxAttempts,
      p_block_ms: input.config.blockMs,
    }));
  } catch {
    return rateLimitStorageFailure();
  }

  if (error) {
    return rateLimitStorageFailure();
  }

  return { ok: true };
}

export async function recordAttempt(
  identifier: string,
  success: boolean,
  config: RateLimitConfig = ADMIN_RATE_LIMIT,
): Promise<RateLimitStorageResult> {
  return persistRateLimitAttempt(
    { identifier, success, config },
    (parameters) =>
      getSupabaseAdminClient().rpc("record_rate_limit_attempt", parameters),
  );
}

export async function readRateLimitBlockingState(
  identifiers: string[],
  readRows: RateLimitBlockingStateReader,
): Promise<RateLimitBlockingStateResult> {
  const uniqueIdentifiers = [...new Set(identifiers.filter(Boolean))];
  if (uniqueIdentifiers.length === 0) {
    return { ok: true, blocked: false };
  }

  let data: unknown;
  let error: unknown;

  try {
    ({ data, error } = await readRows());
  } catch {
    return rateLimitStorageFailure();
  }

  if ((error !== null && error !== undefined) || !Array.isArray(data)) {
    return rateLimitStorageFailure();
  }

  for (const row of data) {
    if (!row || typeof row !== "object") {
      return rateLimitStorageFailure();
    }
    const identifier = (row as { identifier?: unknown }).identifier;
    const blockedUntilValue = (row as { blocked_until?: unknown }).blocked_until;
    if (
      typeof identifier !== "string" ||
      !identifier ||
      !uniqueIdentifiers.includes(identifier)
    ) {
      return rateLimitStorageFailure();
    }
    if (blockedUntilValue === null || blockedUntilValue === undefined) {
      continue;
    }
    if (typeof blockedUntilValue !== "string") {
      return rateLimitStorageFailure();
    }
    const blockedUntil = new Date(blockedUntilValue).getTime();
    if (!Number.isFinite(blockedUntil)) {
      return rateLimitStorageFailure();
    }
    if (blockedUntil > Date.now()) {
      return {
        ok: true,
        blocked: true,
        identifier,
        blockedUntil: blockedUntilValue,
      };
    }
  }

  return { ok: true, blocked: false };
}

export async function getBlockingState(
  identifiers: string[],
  config: RateLimitConfig = ADMIN_RATE_LIMIT,
): Promise<RateLimitBlockingStateResult> {
  const uniqueIdentifiers = [...new Set(identifiers.filter(Boolean))];
  return readRateLimitBlockingState(uniqueIdentifiers, () =>
    getSupabaseAdminClient()
      .from(config.table)
      .select("identifier,blocked_until")
      .in("identifier", uniqueIdentifiers),
  );
}

export async function recordAttemptBatch(
  identifiers: string[],
  success: boolean,
  config: RateLimitConfig = ADMIN_RATE_LIMIT,
  dependencies: { recordAttempt?: RateLimitAttemptRecorder } = {},
): Promise<RateLimitBatchStorageResult> {
  const uniqueIdentifiers = [...new Set(identifiers.filter(Boolean))];
  const persistAttempt = dependencies.recordAttempt ?? recordAttempt;
  const results = await Promise.allSettled(
    uniqueIdentifiers.map(async (identifier) =>
      persistAttempt(identifier, success, config),
    ),
  );
  const failedCount = results.filter(
    (result) => result.status === "rejected" || !result.value.ok,
  ).length;

  if (failedCount > 0) {
    return {
      ok: false,
      code: "rate_limit_storage_failed",
      attemptedCount: uniqueIdentifiers.length,
      failedCount,
    };
  }

  return {
    ok: true,
    attemptedCount: uniqueIdentifiers.length,
    failedCount: 0,
  };
}

export const SUGGEST_RATE_LIMIT: RateLimitConfig = {
  table: "suggestion_attempts",
  windowMs: 10 * 60 * 1000,
  maxAttempts: 5,
  blockMs: 30 * 60 * 1000,
};

export const PARTNER_REGISTRATION_RATE_LIMIT: RateLimitConfig = {
  table: "partner_registration_attempts",
  windowMs: 10 * 60 * 1000,
  maxAttempts: 5,
  blockMs: 30 * 60 * 1000,
};
