import { createHash } from "node:crypto";
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
  | {
      readonly ok: false;
      readonly code: "blocked";
      readonly retryAfterSeconds: number;
    }
  | { readonly ok: false; readonly code: "unavailable" };

function normalizeIdentifier(value: string) {
  return createHash("sha256")
    .update(`public-image-proxy:ip:${value.trim().toLowerCase()}`)
    .digest("hex");
}

function getRetryAfterSeconds(blockedUntil: string, now: number) {
  const blockedUntilMs = Date.parse(blockedUntil);
  return Number.isFinite(blockedUntilMs)
    ? Math.max(1, Math.ceil((blockedUntilMs - now) / 1_000))
    : 60;
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
  const ipAddress = input.ipAddress?.trim() || "unknown";

  const readBlockingState = dependencies.getBlockingState ?? getBlockingState;
  const persistAttempt = dependencies.recordAttemptBatch ?? recordAttemptBatch;
  const keys = [getImageProxyRateLimitKey(ipAddress)];

  try {
    const existingBlock = await readBlockingState(keys, IMAGE_PROXY_RATE_LIMIT);
    if (!existingBlock.ok) {
      return { ok: false, code: "unavailable" };
    }
    if (existingBlock.blocked) {
      return {
        ok: false,
        code: "blocked",
        retryAfterSeconds: getRetryAfterSeconds(
          existingBlock.blockedUntil,
          Date.now(),
        ),
      };
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
      ? {
          ok: false,
          code: "blocked",
          retryAfterSeconds: getRetryAfterSeconds(
            newlyBlocked.blockedUntil,
            Date.now(),
          ),
        }
      : { ok: true };
  } catch {
    return { ok: false, code: "unavailable" };
  }
}
