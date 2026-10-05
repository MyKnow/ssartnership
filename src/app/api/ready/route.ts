import { NextResponse } from "next/server";
import {
  checkReadiness,
  createHttpReadinessProbes,
  createReadinessCache,
  type ReadinessResult,
} from "@/lib/readiness";
import { logServerWarning } from "@/lib/server-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dependency readiness for the private telemetry probe. The public edge
 * answers 404 for this path; Docker HEALTHCHECK and public verification keep
 * using `/api/health` so a database outage never becomes a restart loop.
 */
async function runReadiness(): Promise<ReadinessResult> {
  const http = createHttpReadinessProbes({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_INTERNAL_URL: process.env.SUPABASE_INTERNAL_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  });
  const result = await checkReadiness({
    ...http,
    async database(signal) {
      const { error } = await getSupabaseAdminClient()
        .from("public_cache_versions")
        .select("*", { head: true })
        .limit(1)
        .abortSignal(signal);
      return !error;
    },
  });
  if (!result.ok) {
    logServerWarning("[ready] dependency unavailable", {
      gateway: result.checks.gateway.ok,
      storage: result.checks.storage.ok,
      database: result.checks.database.ok,
    });
  }
  return result;
}

const getReadiness = createReadinessCache(runReadiness);

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (process.env.NEXT_PUBLIC_DATA_SOURCE === "mock") {
    return NextResponse.json({ ok: true, mode: "mock", checks: {} }, { headers });
  }
  const result = await getReadiness();
  return NextResponse.json(result, { status: result.ok ? 200 : 503, headers });
}
