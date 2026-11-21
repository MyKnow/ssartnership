export const TOAST_TONES = ["success", "error", "info"] as const;

export type ToastTone = (typeof TOAST_TONES)[number];

export type ToastOptions = {
  /**
   * `error` uses an assertive live region, a danger border, and a longer
   * duration. `success` and `info` keep the original neutral glass toast.
   */
  tone?: ToastTone;
  durationMs?: number;
};

export type ResolvedToastOptions = {
  tone: ToastTone;
  durationMs: number;
  role: "status" | "alert";
};

export const DEFAULT_TOAST_TONE: ToastTone = "info";
export const DEFAULT_TOAST_DURATION_MS = 2_500;
export const ERROR_TOAST_DURATION_MS = 6_000;
export const MIN_TOAST_DURATION_MS = 1_000;
export const MAX_TOAST_DURATION_MS = 15_000;

function isToastTone(value: unknown): value is ToastTone {
  return (
    typeof value === "string" &&
    (TOAST_TONES as readonly string[]).includes(value)
  );
}

export function resolveToastOptions(
  options?: ToastOptions,
): ResolvedToastOptions {
  const tone = isToastTone(options?.tone) ? options.tone : DEFAULT_TOAST_TONE;
  const fallbackDurationMs =
    tone === "error" ? ERROR_TOAST_DURATION_MS : DEFAULT_TOAST_DURATION_MS;
  const requestedDurationMs = options?.durationMs;
  const durationMs =
    typeof requestedDurationMs === "number" &&
    Number.isFinite(requestedDurationMs)
      ? Math.min(
          MAX_TOAST_DURATION_MS,
          Math.max(MIN_TOAST_DURATION_MS, Math.round(requestedDurationMs)),
        )
      : fallbackDurationMs;

  return {
    tone,
    durationMs,
    role: tone === "error" ? "alert" : "status",
  };
}
