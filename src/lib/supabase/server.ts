import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseTransport } from "./transport";

let adminClient: SupabaseClient | null = null;

function getAdminEnv() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const internalSupabaseUrl = process.env.SUPABASE_INTERNAL_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  }

  return { supabaseUrl, internalSupabaseUrl, serviceRoleKey };
}

export function getSupabaseAdminClient() {
  if (adminClient) {
    return adminClient;
  }

  const { supabaseUrl, internalSupabaseUrl, serviceRoleKey } = getAdminEnv();
  const transport = createSupabaseTransport(supabaseUrl, internalSupabaseUrl);
  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
    global: {
      fetch: (input, init) =>
        transport(input, {
          ...init,
          cache: "no-store",
        }),
    },
  });
  return adminClient;
}
