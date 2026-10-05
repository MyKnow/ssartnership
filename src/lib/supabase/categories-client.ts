import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.generated";
import { getSupabaseAdminClient } from "./server";

/** The pilot narrows only categories. Other repositories keep their current contracts. */
export function getSupabaseCategoriesClient(): SupabaseClient<Database> {
  return getSupabaseAdminClient() as SupabaseClient<Database>;
}
