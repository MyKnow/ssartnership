import { logServerError } from "./server-log.ts";

/**
 * Supabase builders resolve `{ error }` instead of rejecting, so an awaited
 * write without destructuring silently ignores failures. Wrap secondary
 * writes (counters, bookkeeping, compensating deletes) whose failure must be
 * visible in the log but must not change the caller's response.
 *
 * - `mode: "log"` (default): log one sanitized line and resolve `false`.
 * - `mode: "throw"`: log, then throw {@link SupabaseWriteFailedError}.
 */
export type SupabaseWriteResult = { error: unknown } | null | undefined;

export class SupabaseWriteFailedError extends Error {
  readonly event: string;

  constructor(event: string) {
    super("supabase_write_failed");
    this.name = "SupabaseWriteFailedError";
    this.event = event;
  }
}

export async function expectNoError(
  operation: PromiseLike<SupabaseWriteResult>,
  event: string,
  options: { mode?: "log" | "throw"; properties?: Record<string, unknown> | null } = {},
): Promise<boolean> {
  let failure: unknown = null;
  try {
    const result = await operation;
    failure = result?.error ?? null;
  } catch (error) {
    failure = error ?? new Error("unknown");
  }
  if (!failure) {
    return true;
  }
  logServerError(event, failure, options.properties);
  if (options.mode === "throw") {
    throw new SupabaseWriteFailedError(event);
  }
  return false;
}
