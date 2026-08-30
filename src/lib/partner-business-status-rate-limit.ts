import {
  buildScopedRateLimitKey,
  getBlockingState,
  recordAttemptBatch,
  type RateLimitConfig,
} from "@/lib/rate-limit";

const ROUTE_KEY = "partner-business-status";

export const PARTNER_BUSINESS_STATUS_RATE_LIMIT = {
  table: "partner_auth_attempts",
  windowMs: 10 * 60 * 1000,
  maxAttempts: 20,
  blockMs: 30 * 60 * 1000,
} as const satisfies RateLimitConfig;

type PartnerBusinessStatusRateLimitInput = {
  accountId: string;
  companyId: string;
};

type PartnerBusinessStatusRateLimitDependencies = {
  getBlockingState?: typeof getBlockingState;
  recordAttemptBatch?: typeof recordAttemptBatch;
};

export type PartnerBusinessStatusRateLimitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "blocked" | "unavailable" };

function normalizeStableIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function getPartnerBusinessStatusRateLimitKey(
  input: PartnerBusinessStatusRateLimitInput,
) {
  const accountId = normalizeStableIdentifier(input.accountId);
  const companyId = normalizeStableIdentifier(input.companyId);
  return buildScopedRateLimitKey(
    ROUTE_KEY,
    "account",
    `${accountId}:company:${companyId}`,
    (value) => value,
  );
}

/**
 * Reserves one shared NTS lookup before the upstream request starts. The
 * authenticated account + authorized company pair is stable across proxies
 * and avoids coupling unrelated partners behind the same NAT address.
 */
export async function consumePartnerBusinessStatusLookupQuota(
  input: PartnerBusinessStatusRateLimitInput,
  dependencies: PartnerBusinessStatusRateLimitDependencies = {},
): Promise<PartnerBusinessStatusRateLimitResult> {
  const lookupBlockingState =
    dependencies.getBlockingState ?? getBlockingState;
  const persistAttempt = dependencies.recordAttemptBatch ?? recordAttemptBatch;
  const keys = [getPartnerBusinessStatusRateLimitKey(input)];

  try {
    const existingBlock = await lookupBlockingState(
      keys,
      PARTNER_BUSINESS_STATUS_RATE_LIMIT,
    );
    if (!existingBlock.ok) {
      return { ok: false, code: "unavailable" };
    }
    if (existingBlock.blocked) {
      return { ok: false, code: "blocked" };
    }

    const recorded = await persistAttempt(
      keys,
      false,
      PARTNER_BUSINESS_STATUS_RATE_LIMIT,
    );
    if (!recorded.ok) {
      return { ok: false, code: "unavailable" };
    }

    // The atomic recorder can establish the block for this very request.
    // Re-check before calling NTS so concurrent bursts cannot all pass through.
    const newlyBlocked = await lookupBlockingState(
      keys,
      PARTNER_BUSINESS_STATUS_RATE_LIMIT,
    );
    if (!newlyBlocked.ok) {
      return { ok: false, code: "unavailable" };
    }
    return newlyBlocked.blocked
      ? { ok: false, code: "blocked" }
      : { ok: true };
  } catch {
    return { ok: false, code: "unavailable" };
  }
}
