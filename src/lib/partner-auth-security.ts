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

export type PartnerAuthRoute = "login" | "reset-password" | "change-password";

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
  route: PartnerAuthRoute,
  scope: "ip" | "account",
  value: string,
) {
  return `${route}:${scope}:${normalizePartnerLoginId(value)}`;
}

export function getPartnerAuthAttemptKeys(
  route: PartnerAuthRoute,
  context: PartnerAuthRateLimitContext,
) {
  const keys = [
    context.ipAddress
      ? buildPartnerAuthAttemptKey(route, "ip", context.ipAddress)
      : null,
    context.accountIdentifier
      ? buildPartnerAuthAttemptKey(route, "account", context.accountIdentifier)
      : null,
  ];

  return [...new Set(keys.filter((key): key is string => Boolean(key)))];
}

export function getPartnerAuthAttemptScope(identifier: string) {
  return identifier.includes(":account:") ? "account" : "ip";
}

export async function getPartnerAuthBlockingState(
  route: PartnerAuthRoute,
  context: PartnerAuthRateLimitContext,
) {
  const keys = getPartnerAuthAttemptKeys(route, context);
  if (keys.length === 0) {
    return null;
  }

  const blockedState = await getBlockingState(keys, PARTNER_AUTH_RATE_LIMIT);
  return blockedState;
}

export async function recordPartnerAuthAttempt(
  route: PartnerAuthRoute,
  context: PartnerAuthRateLimitContext,
  success: boolean,
) {
  const keys = getPartnerAuthAttemptKeys(route, context);
  if (keys.length === 0) {
    return;
  }

  await recordAttemptBatch(keys, success, PARTNER_AUTH_RATE_LIMIT);
}

export async function delayPartnerAuthAttempt(
  route: PartnerAuthRoute,
  blocked = false,
) {
  const delayMs =
    route === "login"
      ? blocked
        ? 1_200
        : randomInt(500, 901)
      : blocked
        ? 900
        : randomInt(350, 701);
  await sleep(delayMs);
}
