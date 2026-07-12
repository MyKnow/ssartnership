import {
  buildScopedRateLimitKey,
  getBlockingState,
  getScopedRateLimitKeys,
  recordAttemptBatch,
  type RateLimitConfig,
} from "@/lib/rate-limit";

export type GraduateVerificationRateLimitRoute =
  | "graduate-email-send"
  | "graduate-email-verify"
  | "graduate-upload-sign"
  | "graduate-submission"
  | "graduate-password-setup"
  | "graduate-password-reset-send"
  | "graduate-password-reset-verify"
  | "graduate-profile-photo-sign"
  | "graduate-profile-photo-submit";

const GRADUATE_VERIFICATION_RATE_LIMIT: Record<
  GraduateVerificationRateLimitRoute,
  RateLimitConfig
> = {
  "graduate-email-send": {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 3,
    blockMs: 30 * 60 * 1000,
  },
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
  "graduate-profile-photo-sign": {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 8,
    blockMs: 30 * 60 * 1000,
  },
  "graduate-profile-photo-submit": {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 5,
    blockMs: 30 * 60 * 1000,
  },
};

function normalizeRateLimitIdentifier(value: string) {
  return value.trim();
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
