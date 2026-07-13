import {
  getBlockingState,
  getScopedRateLimitKeys,
  recordAttemptBatch,
  type RateLimitConfig,
} from "@/lib/rate-limit";

type MemberEmailVerificationRoute = "send" | "verify";

const MEMBER_EMAIL_VERIFICATION_RATE_LIMIT: RateLimitConfig = {
  table: "member_auth_attempts",
  windowMs: 10 * 60 * 1000,
  maxAttempts: 5,
  blockMs: 30 * 60 * 1000,
};

function getMemberEmailVerificationKeys(
  route: MemberEmailVerificationRoute,
  context: {
    ipAddress?: string | null;
    accountIdentifier?: string | null;
  },
) {
  return getScopedRateLimitKeys(`member-email-${route}`, {
    ...context,
    normalize: (value) => value.trim().toLowerCase(),
  });
}

export async function getMemberEmailVerificationBlockingState(
  route: MemberEmailVerificationRoute,
  context: {
    ipAddress?: string | null;
    accountIdentifier?: string | null;
  },
) {
  return getBlockingState(
    getMemberEmailVerificationKeys(route, context),
    MEMBER_EMAIL_VERIFICATION_RATE_LIMIT,
  );
}

export async function recordMemberEmailVerificationAttempt(
  route: MemberEmailVerificationRoute,
  context: {
    ipAddress?: string | null;
    accountIdentifier?: string | null;
  },
  success: boolean,
) {
  return recordAttemptBatch(
    getMemberEmailVerificationKeys(route, context),
    success,
    MEMBER_EMAIL_VERIFICATION_RATE_LIMIT,
  );
}
