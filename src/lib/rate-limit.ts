import { getSupabaseAdminClient } from "@/lib/supabase/server";

type AttemptState = {
  id: string;
  count: number;
  firstAttemptAt: string;
  blockedUntil?: string | null;
};

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60 * 1000;

function toISOString(date: Date) {
  return date.toISOString();
}

export async function isBlocked(identifier: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_login_attempts")
    .select("blocked_until")
    .eq("identifier", identifier)
    .maybeSingle();

  if (error || !data?.blocked_until) {
    return false;
  }

  return new Date(data.blocked_until).getTime() > Date.now();
}

export async function recordAttempt(identifier: string, success: boolean) {
  const supabase = getSupabaseAdminClient();

  if (success) {
    await supabase
      .from("admin_login_attempts")
      .delete()
      .eq("identifier", identifier);
    return;
  }

  const { data } = await supabase
    .from("admin_login_attempts")
    .select("id,count,first_attempt_at,blocked_until")
    .eq("identifier", identifier)
    .maybeSingle();

  const now = new Date();

  if (!data) {
    await supabase.from("admin_login_attempts").insert({
      identifier,
      count: 1,
      first_attempt_at: toISOString(now),
    });
    return;
  }

  const state: AttemptState = {
    id: data.id,
    count: data.count ?? 0,
    firstAttemptAt: data.first_attempt_at,
    blockedUntil: data.blocked_until,
  };

  const windowStart = new Date(state.firstAttemptAt).getTime();
  if (now.getTime() - windowStart > WINDOW_MS) {
    await supabase
      .from("admin_login_attempts")
      .update({
        count: 1,
        first_attempt_at: toISOString(now),
        blocked_until: null,
      })
      .eq("id", state.id);
    return;
  }

  const nextCount = state.count + 1;
  const updatePayload: {
    count: number;
    blocked_until?: string | null;
  } = {
    count: nextCount,
  };

  if (nextCount >= MAX_ATTEMPTS) {
    updatePayload.blocked_until = toISOString(
      new Date(now.getTime() + BLOCK_MS),
    );
  }

  await supabase
    .from("admin_login_attempts")
    .update(updatePayload)
    .eq("id", state.id);
}
