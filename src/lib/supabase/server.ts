import { createClient } from "@supabase/supabase-js";

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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL 환경 변수가 필요합니다.");
  }

  if (anonKey) {
    return { supabaseUrl, key: anonKey };
  }

  if (serviceRoleKey) {
    return { supabaseUrl, key: serviceRoleKey };
  }

  throw new Error("SUPABASE_ANON_KEY 환경 변수가 필요합니다.");
}

export function getSupabaseAdminClient() {
  const { supabaseUrl, serviceRoleKey } = getAdminEnv();
  return createClient(supabaseUrl, serviceRoleKey, {
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
}

export function getSupabasePublicClient(revalidateSeconds = 300) {
  const { supabaseUrl, key } = getPublicEnv();
  return createClient(supabaseUrl, key, {
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
}
