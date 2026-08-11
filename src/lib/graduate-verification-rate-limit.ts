import {
  buildScopedRateLimitKey,
  getBlockingState,
  getScopedRateLimitKeys,
  recordAttemptBatch,
  type RateLimitConfig,
} from "@/lib/rate-limit";

export type GraduateVerificationRateLimitRoute =
  | "graduate-email-verify"
  | "graduate-upload-sign"
  | "graduate-submission"
  | "graduate-password-setup"
  | "graduate-password-reset-send"
  | "graduate-password-reset-verify"
  | "member-profile-photo-sign"
  | "member-profile-photo-submit"
  | "admin-member-profile-photo-sign"
  | "admin-member-profile-photo-submit";

const GRADUATE_VERIFICATION_RATE_LIMIT: Record<
  GraduateVerificationRateLimitRoute,
  RateLimitConfig
> = {
  "graduate-email-verify": {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 5,
    blockMs: 30 * 60 * 1000,
  },
  "graduate-upload-sign": {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 8,
    blockMs: 30 * 60 * 1000,
  },
  "graduate-submission": {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 5,
    blockMs: 30 * 60 * 1000,
  },
  "graduate-password-setup": {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 5,
    blockMs: 30 * 60 * 1000,
  },
  "graduate-password-reset-send": {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 3,
    blockMs: 30 * 60 * 1000,
  },
  "graduate-password-reset-verify": {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 5,
    blockMs: 30 * 60 * 1000,
  },
  "member-profile-photo-sign": {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 8,
    blockMs: 30 * 60 * 1000,
  },
  "member-profile-photo-submit": {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 5,
    blockMs: 30 * 60 * 1000,
  },
  "admin-member-profile-photo-sign": {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 12,
    blockMs: 15 * 60 * 1000,
  },
  "admin-member-profile-photo-submit": {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 8,
    blockMs: 15 * 60 * 1000,
  },
};

type GraduateEmailSendRateLimitContext = {
  ipAddress?: string | null;
  accountIdentifier?: string | null;
};

const GRADUATE_EMAIL_SEND_SUCCESS_ROUTE =
  "graduate-email-send-success" as const;
// Keep provider outages out of the legacy authentication-failure keyspace so
// stale 30-minute delivery blocks no longer deny a valid signup request.
const GRADUATE_EMAIL_PROVIDER_FAILURE_ROUTE =
  "graduate-email-send-provider-failure" as const;

export const GRADUATE_EMAIL_SEND_SUCCESS_RATE_LIMIT = {
  table: "member_auth_attempts",
  windowMs: 10 * 60 * 1000,
  maxAttempts: 3,
  blockMs: 30 * 60 * 1000,
} satisfies RateLimitConfig;

export const GRADUATE_EMAIL_PROVIDER_FAILURE_RATE_LIMIT = {
  table: "member_auth_attempts",
  windowMs: 60 * 1000,
  maxAttempts: 3,
  blockMs: 60 * 1000,
} satisfies RateLimitConfig;

function normalizeRateLimitIdentifier(value: string) {
  return value.trim();
}

function getGraduateEmailSendKeys(
  route:
    | typeof GRADUATE_EMAIL_SEND_SUCCESS_ROUTE
    | typeof GRADUATE_EMAIL_PROVIDER_FAILURE_ROUTE,
  input: GraduateEmailSendRateLimitContext,
) {
  return getScopedRateLimitKeys(route, {
    ...input,
    normalize: normalizeRateLimitIdentifier,
  });
}

export function getGraduateEmailSendSuccessKeys(
  input: GraduateEmailSendRateLimitContext,
) {
  return getGraduateEmailSendKeys(GRADUATE_EMAIL_SEND_SUCCESS_ROUTE, {
    accountIdentifier: input.accountIdentifier,
  });
}

export function getGraduateEmailProviderFailureKeys(
  input: GraduateEmailSendRateLimitContext,
) {
  return getGraduateEmailSendKeys(
    GRADUATE_EMAIL_PROVIDER_FAILURE_ROUTE,
    input,
  );
}

export async function getGraduateEmailSendBlockingState(
  input: GraduateEmailSendRateLimitContext,
) {
  const [sendQuota, providerFailure] = await Promise.all([
    getBlockingState(
      getGraduateEmailSendSuccessKeys(input),
      GRADUATE_EMAIL_SEND_SUCCESS_RATE_LIMIT,
    ),
    getBlockingState(
      getGraduateEmailProviderFailureKeys(input),
      GRADUATE_EMAIL_PROVIDER_FAILURE_RATE_LIMIT,
    ),
  ]);
  const activeStates = [
    sendQuota ? { ...sendQuota, reason: "send_quota" as const } : null,
    providerFailure
      ? { ...providerFailure, reason: "provider_failure_backoff" as const }
      : null,
  ].filter((state): state is NonNullable<typeof state> => Boolean(state));

  return activeStates.sort(
    (left, right) =>
      Date.parse(right.blockedUntil) - Date.parse(left.blockedUntil),
  )[0] ?? null;
}

export async function recordGraduateEmailSendSuccess(
  input: GraduateEmailSendRateLimitContext,
) {
  await recordAttemptBatch(
    getGraduateEmailSendSuccessKeys(input),
    false,
    GRADUATE_EMAIL_SEND_SUCCESS_RATE_LIMIT,
  );
}

export async function recordGraduateEmailProviderFailure(
  input: GraduateEmailSendRateLimitContext,
) {
  await recordAttemptBatch(
    getGraduateEmailProviderFailureKeys(input),
    false,
    GRADUATE_EMAIL_PROVIDER_FAILURE_RATE_LIMIT,
  );
}

export async function clearGraduateEmailProviderFailures(
  input: GraduateEmailSendRateLimitContext,
) {
  await recordAttemptBatch(
    getGraduateEmailProviderFailureKeys(input),
    true,
    GRADUATE_EMAIL_PROVIDER_FAILURE_RATE_LIMIT,
  );
}

export function getGraduateVerificationAttemptKeys(input: {
  route: GraduateVerificationRateLimitRoute;
  ipAddress?: string | null;
  accountIdentifier?: string | null;
}) {
  return getScopedRateLimitKeys(input.route, {
    ipAddress: input.ipAddress,
    accountIdentifier: input.accountIdentifier,
    normalize: normalizeRateLimitIdentifier,
  });
}

export async function isGraduateVerificationBlocked(input: {
  route: GraduateVerificationRateLimitRoute;
  ipAddress?: string | null;
  accountIdentifier?: string | null;
}) {
  const keys = getGraduateVerificationAttemptKeys(input);
  if (keys.length === 0) return null;
  return getBlockingState(keys, GRADUATE_VERIFICATION_RATE_LIMIT[input.route]);
}

export async function recordGraduateVerificationAttempt(input: {
  route: GraduateVerificationRateLimitRoute;
  ipAddress?: string | null;
  accountIdentifier?: string | null;
  success: boolean;
}) {
  const keys = getGraduateVerificationAttemptKeys(input);
  if (keys.length === 0) return;
  await recordAttemptBatch(
    keys,
    input.success,
    GRADUATE_VERIFICATION_RATE_LIMIT[input.route],
  );
}

export function buildGraduateVerificationAttemptKey(
  route: GraduateVerificationRateLimitRoute,
  scope: "ip" | "account",
  value: string,
) {
  return buildScopedRateLimitKey(route, scope, value, normalizeRateLimitIdentifier);
}
