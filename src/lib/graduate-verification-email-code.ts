export const GRADUATE_EMAIL_CODE_TTL_SECONDS = 5 * 60;

export function getGraduateEmailCodeRemainingSeconds(expiresAt: number, now = Date.now()) {
  return Math.max(0, Math.ceil((expiresAt - now) / 1_000));
}

export function formatGraduateEmailCodeRemainingTime(remainingSeconds: number) {
  const safeRemainingSeconds = Math.max(0, Math.floor(remainingSeconds));
  const minutes = Math.floor(safeRemainingSeconds / 60);
  const seconds = safeRemainingSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatGraduateEmailCodeExpirationNotice(expiresInSeconds: number) {
  const minutes = Math.max(1, Math.ceil(expiresInSeconds / 60));
  return `코드는 발급 후 ${minutes}분 동안 한 번만 사용할 수 있습니다.`;
}
