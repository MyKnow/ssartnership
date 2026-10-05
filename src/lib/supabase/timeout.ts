/**
 * Upper bounds for server-side Supabase SDK requests (REST, RPC, Auth and
 * Storage all share the client's `global.fetch`).
 *
 * Without a bound a stalled gateway or database keeps a request handler, a
 * cron job, or an admin export waiting until undici's own 5-minute timers fire,
 * long after the edge proxy (70s) and the cron client (60s) have given up. The
 * defaults follow the external call budget in docs/operations/reliability.md:
 * every downstream call must finish before the caller that waits for it.
 */
export const DEFAULT_SUPABASE_FETCH_TIMEOUT_MS = 30_000;
export const DEFAULT_SUPABASE_STORAGE_FETCH_TIMEOUT_MS = 60_000;
export const MIN_SUPABASE_FETCH_TIMEOUT_MS = 1_000;
export const MAX_SUPABASE_FETCH_TIMEOUT_MS = 300_000;

const STORAGE_PATH_PREFIX = "/storage/v1/";

export type SupabaseFetchTimeouts = Readonly<{
  /** REST·RPC·Auth 요청 상한. */
  defaultMs: number;
  /** `/storage/v1/` 요청(업로드·다운로드·이동·서명) 상한. */
  storageMs: number;
}>;

type SupabaseFetchTimeoutEnvName =
  | "SUPABASE_FETCH_TIMEOUT_MS"
  | "SUPABASE_STORAGE_FETCH_TIMEOUT_MS";

function parseTimeoutMs(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d+$/u.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  if (
    !Number.isSafeInteger(parsed)
    || parsed < MIN_SUPABASE_FETCH_TIMEOUT_MS
    || parsed > MAX_SUPABASE_FETCH_TIMEOUT_MS
  ) {
    return null;
  }

  return parsed;
}

function warnInvalidTimeoutEnv(name: SupabaseFetchTimeoutEnvName) {
  // Report the name only. A typo in a tuning knob must not take down every
  // database call, so the documented default stays in effect.
  console.warn("[supabase] invalid timeout env ignored; using the default", {
    env: name,
    minimumMs: MIN_SUPABASE_FETCH_TIMEOUT_MS,
    maximumMs: MAX_SUPABASE_FETCH_TIMEOUT_MS,
  });
}

export function resolveSupabaseFetchTimeouts(
  env: Partial<NodeJS.ProcessEnv> = process.env,
  onInvalid: (name: SupabaseFetchTimeoutEnvName) => void = warnInvalidTimeoutEnv,
): SupabaseFetchTimeouts {
  const defaultMs = parseTimeoutMs(env.SUPABASE_FETCH_TIMEOUT_MS);
  if (defaultMs === null && env.SUPABASE_FETCH_TIMEOUT_MS?.trim()) {
    onInvalid("SUPABASE_FETCH_TIMEOUT_MS");
  }

  const storageMs = parseTimeoutMs(env.SUPABASE_STORAGE_FETCH_TIMEOUT_MS);
  if (storageMs === null && env.SUPABASE_STORAGE_FETCH_TIMEOUT_MS?.trim()) {
    onInvalid("SUPABASE_STORAGE_FETCH_TIMEOUT_MS");
  }

  return {
    defaultMs: defaultMs ?? DEFAULT_SUPABASE_FETCH_TIMEOUT_MS,
    storageMs: storageMs ?? DEFAULT_SUPABASE_STORAGE_FETCH_TIMEOUT_MS,
  };
}

function readRequestPathname(input: RequestInfo | URL): string | null {
  try {
    if (input instanceof Request) {
      return new URL(input.url).pathname;
    }

    return new URL(input instanceof URL ? input.href : input).pathname;
  } catch {
    return null;
  }
}

export function getSupabaseRequestTimeoutMs(
  input: RequestInfo | URL,
  timeouts: SupabaseFetchTimeouts,
): number {
  return readRequestPathname(input)?.startsWith(STORAGE_PATH_PREFIX)
    ? timeouts.storageMs
    : timeouts.defaultMs;
}

/**
 * Adds a per-request deadline to a Supabase transport. A caller-supplied
 * signal (`.abortSignal()` on a query, or a Request's own signal) keeps
 * working: whichever fires first aborts the request.
 *
 * The timeout surfaces as a `TimeoutError` (`{ error }` from PostgREST and
 * Storage, a rejection elsewhere). It is a transient outcome; callers must not
 * treat it as "not found" or as a permanent rejection.
 *
 * Next (16.3 `dedupe-fetch`) shares identical GETs within one render only when
 * `init` carries no signal. The private gateway transport hands Next a Request,
 * which Next merges with `init`, so sharing still applies there; a direct
 * connection without `SUPABASE_INTERNAL_URL` loses it. Reads repeated within a
 * render belong in React `cache()` either way.
 */
export function withSupabaseTimeout(
  fetchImpl: typeof fetch,
  timeouts: SupabaseFetchTimeouts,
): typeof fetch {
  return (input, init) => {
    const timeoutSignal = AbortSignal.timeout(
      getSupabaseRequestTimeoutMs(input, timeouts),
    );
    // `init.signal` overrides a Request's own signal in fetch(), so keep the
    // same precedence when combining it with the deadline.
    const callerSignal =
      init?.signal ?? (input instanceof Request ? input.signal : undefined);

    return fetchImpl(input, {
      ...init,
      signal: callerSignal
        ? AbortSignal.any([callerSignal, timeoutSignal])
        : timeoutSignal,
    });
  };
}
