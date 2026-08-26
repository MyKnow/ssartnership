export const MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS = 10 * 60;
export const MEMBER_EMAIL_RESEND_COOLDOWN_SECONDS = 60;

export function getMemberEmailDeadline(
  durationSeconds: unknown,
  fallbackSeconds: number,
  now = Date.now(),
) {
  const resolvedDuration =
    typeof durationSeconds === "number" &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0
      ? durationSeconds
      : fallbackSeconds;
  return now + Math.ceil(resolvedDuration) * 1_000;
}

export function resolveMemberEmailDeadline(
  serverTimestamp: unknown,
  durationSeconds: unknown,
  fallbackSeconds: number,
  now = Date.now(),
) {
  if (typeof serverTimestamp === "string") {
    const parsedTimestamp = Date.parse(serverTimestamp);
    if (Number.isFinite(parsedTimestamp)) {
      return parsedTimestamp;
    }
  }
  return getMemberEmailDeadline(durationSeconds, fallbackSeconds, now);
}

export function getMemberEmailRemainingSeconds(
  deadline: number | null,
  now = Date.now(),
) {
  if (deadline === null || !Number.isFinite(deadline)) {
    return 0;
  }
  return Math.max(0, Math.ceil((deadline - now) / 1_000));
}

export function formatMemberEmailRemainingTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
