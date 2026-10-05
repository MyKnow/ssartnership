/**
 * Dependency readiness for the self-hosted runtime.
 *
 * `/api/health` stays a liveness probe (Docker HEALTHCHECK, public health
 * verification). This module answers "can the app serve real requests now?"
 * for the private telemetry probe. A dependency outage must surface as a
 * metric/alert, never as a container restart loop.
 */

export const READINESS_DEPENDENCIES = ["gateway", "storage", "database"] as const;
export type ReadinessDependency = (typeof READINESS_DEPENDENCIES)[number];

export const READINESS_TIMEOUT_MS = 1_500;
export const READINESS_CACHE_MS = 5_000;

export type ReadinessCheck = { ok: boolean; latencyMs: number };
export type ReadinessResult = {
  ok: boolean;
  checks: Record<ReadinessDependency, ReadinessCheck>;
};

export type ReadinessProbe = (signal: AbortSignal) => Promise<boolean>;
export type ReadinessProbes = Record<ReadinessDependency, ReadinessProbe>;

type SupabaseReadinessEnv = {
  SUPABASE_URL?: string;
  SUPABASE_INTERNAL_URL?: string;
  SUPABASE_ANON_KEY?: string;
};

/** Resolves the origin the server uses for Supabase calls (internal first). */
export function resolveReadinessOrigin(env: SupabaseReadinessEnv) {
  const candidate = env.SUPABASE_INTERNAL_URL || env.SUPABASE_URL;
  if (!candidate) {
    return null;
  }
  try {
    const url = new URL(candidate);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

async function drain(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // The status code is the whole signal.
  }
}

/** HTTP probes for the Supabase gateway (PostgREST root) and Storage. */
export function createHttpReadinessProbes(
  env: SupabaseReadinessEnv,
  fetchImpl: typeof fetch = fetch,
): Pick<ReadinessProbes, "gateway" | "storage"> {
  const origin = resolveReadinessOrigin(env);
  const anonKey = env.SUPABASE_ANON_KEY;
  return {
    async gateway(signal) {
      if (!origin || !anonKey) return false;
      const response = await fetchImpl(`${origin}/rest/v1/`, {
        method: "HEAD",
        headers: { apikey: anonKey },
        redirect: "error",
        cache: "no-store",
        signal,
      });
      await drain(response);
      return response.ok;
    },
    async storage(signal) {
      if (!origin) return false;
      const response = await fetchImpl(`${origin}/storage/v1/status`, {
        method: "GET",
        redirect: "error",
        cache: "no-store",
        signal,
      });
      await drain(response);
      return response.ok;
    },
  };
}

async function runProbe(
  probe: ReadinessProbe,
  timeoutMs: number,
  now: () => number,
): Promise<ReadinessCheck> {
  const started = now();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(false);
    }, timeoutMs);
  });
  let ok = false;
  try {
    ok = await Promise.race([
      probe(controller.signal).then((value) => value === true, () => false),
      timeout,
    ]);
  } catch {
    ok = false;
  } finally {
    clearTimeout(timer);
  }
  return { ok, latencyMs: Math.max(0, Math.round(now() - started)) };
}

/** Runs every probe in parallel; the whole check is bounded by `timeoutMs`. */
export async function checkReadiness(
  probes: ReadinessProbes,
  { timeoutMs = READINESS_TIMEOUT_MS, now = () => performance.now() }: { timeoutMs?: number; now?: () => number } = {},
): Promise<ReadinessResult> {
  const results = await Promise.all(
    READINESS_DEPENDENCIES.map((dependency) => runProbe(probes[dependency], timeoutMs, now)),
  );
  const checks = Object.fromEntries(
    READINESS_DEPENDENCIES.map((dependency, index) => [dependency, results[index]]),
  ) as Record<ReadinessDependency, ReadinessCheck>;
  return { ok: results.every((result) => result.ok), checks };
}

/**
 * Coalesces concurrent and repeated requests for a short window so the
 * endpoint cannot be used to amplify load on the database.
 */
export function createReadinessCache(
  run: () => Promise<ReadinessResult>,
  { ttlMs = READINESS_CACHE_MS, now = () => Date.now() }: { ttlMs?: number; now?: () => number } = {},
) {
  let cached: { at: number; value: Promise<ReadinessResult> } | null = null;
  return () => {
    const time = now();
    if (!cached || time - cached.at >= ttlMs) {
      const value = run();
      cached = { at: time, value };
      value.catch(() => {
        cached = null;
      });
    }
    return cached.value;
  };
}
