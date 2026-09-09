import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseTransport } from "./transport";

let adminClient: SupabaseClient | null = null;
const publicClients = new Map<number, SupabaseClient>();

function getAdminEnv() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const internalSupabaseUrl = process.env.SUPABASE_INTERNAL_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  }

  return { supabaseUrl, internalSupabaseUrl, serviceRoleKey };
}

function getPublicEnv() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const internalSupabaseUrl = process.env.SUPABASE_INTERNAL_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL 환경 변수가 필요합니다.");
  }

  if (!anonKey) {
    throw new Error("SUPABASE_ANON_KEY 환경 변수가 필요합니다.");
  }

  return { supabaseUrl, internalSupabaseUrl, key: anonKey };
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

export function getSupabasePublicClient(revalidateSeconds = 300) {
  const cachedClient = publicClients.get(revalidateSeconds);
  if (cachedClient) {
    return cachedClient;
  }

  const { supabaseUrl, internalSupabaseUrl, key } = getPublicEnv();
  const transport = createSupabaseTransport(supabaseUrl, internalSupabaseUrl);
  const publicClient = createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
    },
    global: {
      fetch: (input, init) =>
        transport(input, {
          ...init,
          next: { revalidate: revalidateSeconds },
        }),
    },
  });
  publicClients.set(revalidateSeconds, publicClient);
  return publicClient;
}
