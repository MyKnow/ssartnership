import { randomInt } from "node:crypto";

type RateLimitConfig = {
  table: string;
  windowMs: number;
  maxAttempts: number;
  blockMs: number;
};

export type MemberAuthRoute =
  | "login"
  | "request-code"
  | "verify-code"
  | "reset-password"
  | "change-password";

type MemberAuthAttemptContext = {
  ipAddress?: string | null;
  accountIdentifier?: string | null;
};

const MEMBER_AUTH_ROUTES: MemberAuthRoute[] = [
  "login",
  "request-code",
  "verify-code",
  "reset-password",
  "change-password",
];

export const MEMBER_AUTH_RATE_LIMIT: RateLimitConfig = {
  table: "member_auth_attempts",
  windowMs: 10 * 60 * 1000,
  maxAttempts: 5,
  blockMs: 30 * 60 * 1000,
};

const MEMBER_AUTH_FAILURE_DELAY_MS: Record<
  MemberAuthRoute,
  {
    min: number;
    max: number;
  }
> = {
  login: {
    min: 500,
    max: 900,
  },
  "request-code": {
    min: 350,
    max: 700,
  },
  "verify-code": {
    min: 350,
    max: 700,
  },
  "reset-password": {
    min: 350,
    max: 700,
  },
  "change-password": {
    min: 350,
    max: 700,
  },
};

function normalizeAttemptIdentifier(value: string) {
  return value.trim().toLowerCase();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSupabaseAdminClientLazy() {
  const { getSupabaseAdminClient } = await import("./supabase/server");
  return getSupabaseAdminClient();
}

type AttemptState = {
  id: string;
  count: number;
  firstAttemptAt: string;
  blockedUntil?: string | null;
};

function toISOString(date: Date) {
  return date.toISOString();
}

export function buildMemberAuthAttemptKey(
  route: MemberAuthRoute,
  scope: "ip" | "account",
  value: string,
) {
  return `${route}:${scope}:${normalizeAttemptIdentifier(value)}`;
}

export function getMemberAuthAttemptKeys(
  route: MemberAuthRoute,
  context: MemberAuthAttemptContext,
) {
  const keys = [
    context.ipAddress
      ? buildMemberAuthAttemptKey(route, "ip", context.ipAddress)
      : null,
    context.accountIdentifier
      ? buildMemberAuthAttemptKey(route, "account", context.accountIdentifier)
      : null,
  ];

  return [
    ...new Set(keys.filter((key): key is string => Boolean(key))),
  ];
}

export function getMemberAuthCleanupKeys(
  identifiers: Array<string | null | undefined>,
) {
  const uniqueIdentifiers = [
    ...new Set(
      identifiers
        .filter((identifier): identifier is string => Boolean(identifier))
        .map(normalizeAttemptIdentifier),
    ),
  ];

  return uniqueIdentifiers.flatMap((identifier) =>
    MEMBER_AUTH_ROUTES.map((route) =>
      buildMemberAuthAttemptKey(route, "account", identifier),
    ),
  );
}

export function getMemberAuthAttemptScope(identifier: string) {
  return identifier.includes(":account:") ? "account" : "ip";
}

export async function getMemberAuthBlockingState(
  route: MemberAuthRoute,
  context: MemberAuthAttemptContext,
) {
  const keys = getMemberAuthAttemptKeys(route, context);
  if (keys.length === 0) {
    return null;
  }

  const supabase = await getSupabaseAdminClientLazy();
  const { data, error } = await supabase
    .from(MEMBER_AUTH_RATE_LIMIT.table)
    .select("identifier,blocked_until")
    .in("identifier", keys);

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

export async function recordMemberAuthAttempt(
  route: MemberAuthRoute,
  context: MemberAuthAttemptContext,
  success: boolean,
) {
  const keys = getMemberAuthAttemptKeys(route, context);
  if (keys.length === 0) {
    return;
  }

  const supabase = await getSupabaseAdminClientLazy();

  if (success) {
    await supabase
      .from(MEMBER_AUTH_RATE_LIMIT.table)
      .delete()
      .in("identifier", keys);
    return;
  }

  await Promise.all(
    keys.map(async (identifier) => {
      const { data } = await supabase
        .from(MEMBER_AUTH_RATE_LIMIT.table)
        .select("id,count,first_attempt_at,blocked_until")
        .eq("identifier", identifier)
        .maybeSingle();

      const now = new Date();

      if (!data) {
        await supabase.from(MEMBER_AUTH_RATE_LIMIT.table).insert({
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
      if (now.getTime() - windowStart > MEMBER_AUTH_RATE_LIMIT.windowMs) {
        await supabase
          .from(MEMBER_AUTH_RATE_LIMIT.table)
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

      if (nextCount >= MEMBER_AUTH_RATE_LIMIT.maxAttempts) {
        updatePayload.blocked_until = toISOString(
          new Date(now.getTime() + MEMBER_AUTH_RATE_LIMIT.blockMs),
        );
      }

      await supabase
        .from(MEMBER_AUTH_RATE_LIMIT.table)
        .update(updatePayload)
        .eq("id", state.id);
    }),
  );
}

export async function delayMemberAuthAttempt(
  route: MemberAuthRoute,
  blocked = false,
) {
  const { min, max } = MEMBER_AUTH_FAILURE_DELAY_MS[route];
  const delayMs = blocked ? max + 400 : randomInt(min, max + 1);
  await sleep(delayMs);
}
