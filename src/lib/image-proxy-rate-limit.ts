import {
  buildScopedRateLimitKey,
  getBlockingState,
  recordAttemptBatch,
  type RateLimitConfig,
} from "@/lib/rate-limit";

const ROUTE_KEY = "public-image-proxy";

const IMAGE_PROXY_RATE_LIMIT = {
  table: "suggestion_attempts",
  windowMs: 60 * 1000,
  maxAttempts: 120,
  blockMs: 5 * 60 * 1000,
} as const satisfies RateLimitConfig;

type ImageProxyRateLimitDependencies = {
  getBlockingState?: typeof getBlockingState;
  recordAttemptBatch?: typeof recordAttemptBatch;
};

export type ImageProxyRateLimitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "blocked" | "unavailable" };

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function getImageProxyRateLimitKey(ipAddress: string) {
  return buildScopedRateLimitKey(
    ROUTE_KEY,
    "ip",
    ipAddress,
    normalizeIdentifier,
  );
}

export async function consumeImageProxyRequestQuota(
  input: { ipAddress?: string | null },
  dependencies: ImageProxyRateLimitDependencies = {},
): Promise<ImageProxyRateLimitResult> {
  const ipAddress = input.ipAddress?.trim();
  if (!ipAddress) {
    return { ok: true };
  }

  const readBlockingState = dependencies.getBlockingState ?? getBlockingState;
  const persistAttempt = dependencies.recordAttemptBatch ?? recordAttemptBatch;
  const keys = [getImageProxyRateLimitKey(ipAddress)];

  try {
    const existingBlock = await readBlockingState(keys, IMAGE_PROXY_RATE_LIMIT);
    if (!existingBlock.ok) {
      return { ok: false, code: "unavailable" };
    }
    if (existingBlock.blocked) {
      return { ok: false, code: "blocked" };
    }

    const recorded = await persistAttempt(
      keys,
      false,
      IMAGE_PROXY_RATE_LIMIT,
    );
    if (!recorded.ok) {
      return { ok: false, code: "unavailable" };
    }

    const newlyBlocked = await readBlockingState(keys, IMAGE_PROXY_RATE_LIMIT);
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
