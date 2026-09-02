export const MAX_APPLE_WALLET_PUSH_TOKENS_PER_BATCH = 1_000;
export const APPLE_WALLET_DEVICE_CLEANUP_CONCURRENCY = 8;

export function normalizeAppleWalletDeviceRegistrationReadLimit(value: number) {
  if (!Number.isFinite(value)) {
    return MAX_APPLE_WALLET_PUSH_TOKENS_PER_BATCH;
  }
  return Math.min(
    MAX_APPLE_WALLET_PUSH_TOKENS_PER_BATCH,
    Math.max(1, Math.trunc(value)),
  );
}
