import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;
const publicClients = new Map<number, SupabaseClient>();

function getAdminEnv() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  }

  return { supabaseUrl, serviceRoleKey };
}

function getPublicEnv() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL 환경 변수가 필요합니다.");
  }

  if (!anonKey) {
    throw new Error("SUPABASE_ANON_KEY 환경 변수가 필요합니다.");
  }

  return { supabaseUrl, key: anonKey };
}

export function getSupabaseAdminClient() {
  if (adminClient) {
    return adminClient;
  }

  const { supabaseUrl, serviceRoleKey } = getAdminEnv();
  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
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

  const { supabaseUrl, key } = getPublicEnv();
  const publicClient = createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          next: { revalidate: revalidateSeconds },
        }),
    },
  });
  publicClients.set(revalidateSeconds, publicClient);
  return publicClient;
}
