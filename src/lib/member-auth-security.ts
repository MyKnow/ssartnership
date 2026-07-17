import { randomInt } from "node:crypto";
import {
  buildScopedRateLimitKey,
  getBlockingState,
  getRateLimitAttemptScope,
  getScopedRateLimitCleanupKeys,
  getScopedRateLimitKeys,
  recordAttemptBatch,
  type RateLimitConfig,
} from "@/lib/rate-limit";

export type MemberAuthRoute =
  | "login"
  | "reset-password"
  | "member-email-recovery"
  | "mattermost-code-issue"
  | "mattermost-code-verify"
  | "change-password"
  | "manual-password-action";

type MemberAuthAttemptContext = {
  ipAddress?: string | null;
  accountIdentifier?: string | null;
};

const MEMBER_AUTH_ROUTES: MemberAuthRoute[] = [
  "login",
  "reset-password",
  "member-email-recovery",
  "mattermost-code-issue",
  "mattermost-code-verify",
  "change-password",
  "manual-password-action",
];

export const MEMBER_AUTH_RATE_LIMIT: RateLimitConfig = {
  table: "member_auth_attempts",
  windowMs: 10 * 60 * 1000,
  maxAttempts: 5,
  blockMs: 30 * 60 * 1000,
};

const MEMBER_AUTH_FAILURE_DELAY_MS: Record<
  MemberAuthRoute,
  {
    min: number;
    max: number;
  }
> = {
  login: {
    min: 500,
    max: 900,
  },
  "mattermost-code-issue": {
    min: 350,
    max: 700,
  },
  "mattermost-code-verify": {
    min: 350,
    max: 700,
  },
  "reset-password": {
    min: 350,
    max: 700,
  },
  "member-email-recovery": {
    min: 350,
    max: 700,
  },
  "change-password": {
    min: 350,
    max: 700,
  },
  "manual-password-action": {
    min: 350,
    max: 700,
  },
};

function normalizeAttemptIdentifier(value: string) {
  return value.trim().toLowerCase();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildMemberAuthAttemptKey(
  route: MemberAuthRoute,
  scope: "ip" | "account",
  value: string,
) {
  return buildScopedRateLimitKey(route, scope, value, normalizeAttemptIdentifier);
}

export function getMemberAuthAttemptKeys(
  route: MemberAuthRoute,
  context: MemberAuthAttemptContext,
) {
  return getScopedRateLimitKeys(route, {
    ...context,
    normalize: normalizeAttemptIdentifier,
  });
}

export function getMemberAuthCleanupKeys(
  identifiers: Array<string | null | undefined>,
) {
  return getScopedRateLimitCleanupKeys(
    identifiers,
    MEMBER_AUTH_ROUTES,
    normalizeAttemptIdentifier,
  );
}

export function getMemberAuthAttemptScope(identifier: string) {
  return getRateLimitAttemptScope(identifier);
}

export async function getMemberAuthBlockingState(
  route: MemberAuthRoute,
  context: MemberAuthAttemptContext,
) {
  const keys = getMemberAuthAttemptKeys(route, context);
  if (keys.length === 0) {
    return null;
  }

  return getBlockingState(keys, MEMBER_AUTH_RATE_LIMIT);
}

export async function recordMemberAuthAttempt(
  route: MemberAuthRoute,
  context: MemberAuthAttemptContext,
  success: boolean,
) {
  const keys = getMemberAuthAttemptKeys(route, context);
  if (keys.length === 0) {
    return;
  }

  await recordAttemptBatch(keys, success, MEMBER_AUTH_RATE_LIMIT);
}

export async function delayMemberAuthAttempt(
  route: MemberAuthRoute,
  blocked = false,
) {
  const { min, max } = MEMBER_AUTH_FAILURE_DELAY_MS[route];
  const delayMs = blocked ? max + 400 : randomInt(min, max + 1);
  await sleep(delayMs);
}
