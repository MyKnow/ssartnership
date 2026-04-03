import { getSupabaseAdminClient } from "@/lib/supabase/server";

type AttemptState = {
  id: string;
  count: number;
  firstAttemptAt: string;
  blockedUntil?: string | null;
};

type RateLimitConfig = {
  table: string;
  windowMs: number;
  maxAttempts: number;
  blockMs: number;
};

const ADMIN_RATE_LIMIT: RateLimitConfig = {
  table: "admin_login_attempts",
  windowMs: 10 * 60 * 1000,
  maxAttempts: 5,
  blockMs: 15 * 60 * 1000,
};

export const ADMIN_ACCOUNT_RATE_LIMIT: RateLimitConfig = {
  table: "admin_login_attempts",
  windowMs: 10 * 60 * 1000,
  maxAttempts: 3,
  blockMs: 30 * 60 * 1000,
};

function toISOString(date: Date) {
  return date.toISOString();
}

export async function isBlocked(
  identifier: string,
  config: RateLimitConfig = ADMIN_RATE_LIMIT,
) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(config.table)
    .select("blocked_until")
    .eq("identifier", identifier)
    .maybeSingle();

  if (error || !data?.blocked_until) {
    return false;
  }

  return new Date(data.blocked_until).getTime() > Date.now();
}

export async function recordAttempt(
  identifier: string,
  success: boolean,
  config: RateLimitConfig = ADMIN_RATE_LIMIT,
) {
  const supabase = getSupabaseAdminClient();

  if (success) {
    await supabase
      .from(config.table)
      .delete()
      .eq("identifier", identifier);
    return;
  }

  const { data } = await supabase
    .from(config.table)
    .select("id,count,first_attempt_at,blocked_until")
    .eq("identifier", identifier)
    .maybeSingle();

  const now = new Date();

  if (!data) {
    await supabase.from(config.table).insert({
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
  if (now.getTime() - windowStart > config.windowMs) {
    await supabase
      .from(config.table)
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

  if (nextCount >= config.maxAttempts) {
    updatePayload.blocked_until = toISOString(
      new Date(now.getTime() + config.blockMs),
    );
  }

  await supabase
    .from(config.table)
    .update(updatePayload)
    .eq("id", state.id);
}

export async function getBlockingState(
  identifiers: string[],
  config: RateLimitConfig = ADMIN_RATE_LIMIT,
) {
  const uniqueIdentifiers = [...new Set(identifiers.filter(Boolean))];
  if (uniqueIdentifiers.length === 0) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(config.table)
    .select("identifier,blocked_until")
    .in("identifier", uniqueIdentifiers);

  if (error || !data) {
    return null;
  }

  const activeBlock = data.find((row) => {
    if (!row.blocked_until) {
      return false;
    }
    return new Date(row.blocked_until).getTime() > Date.now();
  });

  if (!activeBlock?.identifier || !activeBlock.blocked_until) {
    return null;
  }

  return {
    identifier: activeBlock.identifier,
    blockedUntil: activeBlock.blocked_until,
  };
}

export async function recordAttemptBatch(
  identifiers: string[],
  success: boolean,
  config: RateLimitConfig = ADMIN_RATE_LIMIT,
) {
  const uniqueIdentifiers = [...new Set(identifiers.filter(Boolean))];
  await Promise.all(
    uniqueIdentifiers.map((identifier) => recordAttempt(identifier, success, config)),
  );
}

export const SUGGEST_RATE_LIMIT: RateLimitConfig = {
  table: "suggestion_attempts",
  windowMs: 10 * 60 * 1000,
  maxAttempts: 5,
  blockMs: 30 * 60 * 1000,
};
