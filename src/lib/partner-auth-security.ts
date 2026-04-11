import { randomInt } from "node:crypto";
import {
  getBlockingState,
  recordAttemptBatch,
} from "@/lib/rate-limit";
import { normalizePartnerLoginId } from "@/lib/partner-utils";

type PartnerAuthRateLimitContext = {
  ipAddress?: string | null;
  accountIdentifier?: string | null;
};

export const PARTNER_AUTH_RATE_LIMIT = {
  table: "partner_auth_attempts",
  windowMs: 10 * 60 * 1000,
  maxAttempts: 5,
  blockMs: 30 * 60 * 1000,
} as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildPartnerAuthAttemptKey(
  scope: "ip" | "account",
  value: string,
) {
  return `login:${scope}:${normalizePartnerLoginId(value)}`;
}

export function getPartnerAuthAttemptKeys(
  context: PartnerAuthRateLimitContext,
) {
  const keys = [
    context.ipAddress ? buildPartnerAuthAttemptKey("ip", context.ipAddress) : null,
    context.accountIdentifier
      ? buildPartnerAuthAttemptKey("account", context.accountIdentifier)
      : null,
  ];

  return [...new Set(keys.filter((key): key is string => Boolean(key)))];
}

export function getPartnerAuthAttemptScope(identifier: string) {
  return identifier.includes(":account:") ? "account" : "ip";
}

export async function getPartnerAuthBlockingState(
  context: PartnerAuthRateLimitContext,
) {
  const keys = getPartnerAuthAttemptKeys(context);
  if (keys.length === 0) {
    return null;
  }

  const blockedState = await getBlockingState(keys, PARTNER_AUTH_RATE_LIMIT);
  return blockedState;
}

export async function recordPartnerAuthAttempt(
  context: PartnerAuthRateLimitContext,
  success: boolean,
) {
  const keys = getPartnerAuthAttemptKeys(context);
  if (keys.length === 0) {
    return;
  }

  await recordAttemptBatch(keys, success, PARTNER_AUTH_RATE_LIMIT);
}

export async function delayPartnerAuthAttempt(blocked = false) {
  const delayMs = blocked ? 1_200 : randomInt(500, 901);
  await sleep(delayMs);
}
