import { getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Database leg of the private `/api/ready` probe: one bounded, read-only head
 * query through the service-role client. `public_cache_versions` is a tiny
 * table every environment has; the probe reads no rows and never writes.
 */
export async function probeDatabaseReadiness(signal: AbortSignal) {
  const { error } = await getSupabaseAdminClient()
    .from("public_cache_versions")
    .select("*", { head: true })
    .limit(1)
    .abortSignal(signal);
  return !error;
}
