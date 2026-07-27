const MAX_DURATION_MS = 120_000;
const TIMING_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

export type ServerTimingRecorder = {
  measure<T>(name: string, operation: () => T | Promise<T>): Promise<Awaited<T>>;
  record(name: string, durationMs: number): void;
  headerValue(): string;
};

function normalizeDuration(value: number) {
  return Number.isFinite(value)
    ? Math.min(MAX_DURATION_MS, Math.max(0, Math.round(value)))
    : 0;
}

/**
 * Formats only bounded, pre-approved server phase names. The header must never
 * contain paths, identifiers, query values, or exception messages.
 */
export function formatServerTimingHeader(
  entries: ReadonlyArray<{ name: string; durationMs: number }>,
) {
  return entries
    .filter((entry) => TIMING_NAME_PATTERN.test(entry.name))
    .map((entry) => `${entry.name};dur=${normalizeDuration(entry.durationMs)}`)
    .join(", ");
}

export function createServerTimingRecorder(): ServerTimingRecorder {
  const startedAt = performance.now();
  const entries = new Map<string, number>();

  return {
    async measure<T>(
      name: string,
      operation: () => T | Promise<T>,
    ): Promise<Awaited<T>> {
      const phaseStartedAt = performance.now();
      try {
        return (await operation()) as Awaited<T>;
      } finally {
        entries.set(name, performance.now() - phaseStartedAt);
      }
    },
    record(name, durationMs) {
      entries.set(name, durationMs);
    },
    headerValue() {
      entries.set("total", performance.now() - startedAt);
      return formatServerTimingHeader(
        Array.from(entries, ([name, durationMs]) => ({ name, durationMs })),
      );
    },
  };
}

export async function withServerTiming<T extends Response>(
  handler: (timing: ServerTimingRecorder) => Promise<T>,
) {
  const timing = createServerTimingRecorder();
  const response = await handler(timing);
  response.headers.set("Server-Timing", timing.headerValue());
  return response;
}
