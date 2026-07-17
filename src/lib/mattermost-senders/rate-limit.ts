import {
  buildScopedRateLimitKey,
  getBlockingState,
  recordAttemptBatch,
  type RateLimitConfig,
} from "@/lib/rate-limit";

const MATTERMOST_SENDER_TEST_RATE_LIMIT: RateLimitConfig = {
  table: "mattermost_sender_test_attempts",
  windowMs: 15 * 60 * 1000,
  maxAttempts: 3,
  blockMs: 30 * 60 * 1000,
};

const TEST_ROUTE = "mattermost-sender-test";

function normalizeRateLimitIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function getMattermostSenderTestAttemptKeys(input: {
  adminId: string;
  candidateId: string;
  ipAddress?: string | null;
}) {
  const keys = [
    buildScopedRateLimitKey(TEST_ROUTE, "account", `admin:${input.adminId}`, normalizeRateLimitIdentifier),
    buildScopedRateLimitKey(TEST_ROUTE, "account", `candidate:${input.candidateId}`, normalizeRateLimitIdentifier),
    buildScopedRateLimitKey(
      TEST_ROUTE,
      "account",
      `admin:${input.adminId}:candidate:${input.candidateId}`,
      normalizeRateLimitIdentifier,
    ),
    input.ipAddress
      ? buildScopedRateLimitKey(TEST_ROUTE, "ip", input.ipAddress, normalizeRateLimitIdentifier)
      : null,
  ];

  return [...new Set(keys.filter((key): key is string => Boolean(key)))];
}

export function getMattermostSenderTestBlockingState(input: {
  adminId: string;
  candidateId: string;
  ipAddress?: string | null;
}) {
  return getBlockingState(
    getMattermostSenderTestAttemptKeys(input),
    MATTERMOST_SENDER_TEST_RATE_LIMIT,
  );
}

export function recordMattermostSenderTestAttempt(
  input: {
    adminId: string;
    candidateId: string;
    ipAddress?: string | null;
  },
  success: boolean,
) {
  return recordAttemptBatch(
    getMattermostSenderTestAttemptKeys(input),
    success,
    MATTERMOST_SENDER_TEST_RATE_LIMIT,
  );
}
