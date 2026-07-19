export const MATTERMOST_VERIFICATION_CODE_TTL_SECONDS = 5 * 60;

export function getMattermostCodeExpiresAt(
  expiresInSeconds: unknown,
  now = Date.now(),
) {
  const safeExpiresInSeconds =
    typeof expiresInSeconds === "number"
    && Number.isSafeInteger(expiresInSeconds)
    && expiresInSeconds > 0
      ? expiresInSeconds
      : MATTERMOST_VERIFICATION_CODE_TTL_SECONDS;

  return now + safeExpiresInSeconds * 1_000;
}

export function getMattermostCodeRemainingSeconds(expiresAt: number, now = Date.now()) {
  return Math.max(0, Math.ceil((expiresAt - now) / 1_000));
}

export function formatMattermostCodeRemainingTime(remainingSeconds: number) {
  const safeRemainingSeconds = Math.max(0, Math.floor(remainingSeconds));
  const minutes = Math.floor(safeRemainingSeconds / 60);
  const seconds = safeRemainingSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
