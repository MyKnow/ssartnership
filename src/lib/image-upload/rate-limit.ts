import {
  getBlockingState,
  getScopedRateLimitKeys,
  recordAttemptBatch,
  type RateLimitConfig,
} from "@/lib/rate-limit";

export type ImageUploadRateLimitAction = "sign" | "complete";

const CONFIG: Record<ImageUploadRateLimitAction, RateLimitConfig> = {
  sign: {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 20,
    blockMs: 15 * 60 * 1000,
  },
  complete: {
    table: "member_auth_attempts",
    windowMs: 10 * 60 * 1000,
    maxAttempts: 30,
    blockMs: 15 * 60 * 1000,
  },
};

function getKeys(action: ImageUploadRateLimitAction, input: { ipAddress?: string | null; accountIdentifier?: string | null }) {
  return getScopedRateLimitKeys(`image-upload-${action}`, {
    ipAddress: input.ipAddress,
    accountIdentifier: input.accountIdentifier,
    normalize: (value) => value.trim(),
  });
}

export async function isImageUploadBlocked(
  action: ImageUploadRateLimitAction,
  input: { ipAddress?: string | null; accountIdentifier?: string | null },
) {
  const keys = getKeys(action, input);
  return keys.length > 0 ? getBlockingState(keys, CONFIG[action]) : null;
}

export async function recordImageUploadAttempt(
  action: ImageUploadRateLimitAction,
  input: { ipAddress?: string | null; accountIdentifier?: string | null; success: boolean },
) {
  const keys = getKeys(action, input);
  if (keys.length > 0) {
    await recordAttemptBatch(keys, input.success, CONFIG[action]);
  }
}
