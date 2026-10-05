import { getAdminAccountById, type AdminAccount } from "@/lib/admin-accounts";
import { isMemberAuthenticationRecent } from "@/lib/member-recent-auth";
import { SITE_URL } from "@/lib/site";

const ADMIN_BRIDGE_FALLBACK = "/admin";
const ADMIN_BRIDGE_PUBLIC_PATHS = [
  "/admin/login",
  "/admin/setup",
  "/admin/session",
  "/admin/denied",
];

type BridgeEligibleAdminAccount = Pick<
  AdminAccount,
  "isActive" | "mustChangePassword"
>;

function isAdminBridgePublicPath(pathname: string) {
  return ADMIN_BRIDGE_PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function sanitizeAdminReturnTo(
  candidate: string | null | undefined,
  fallback = ADMIN_BRIDGE_FALLBACK,
) {
  const safeFallback = fallback.startsWith("/admin") ? fallback : ADMIN_BRIDGE_FALLBACK;
  const trimmed = typeof candidate === "string" ? candidate.trim() : "";
  if (!trimmed || trimmed.startsWith("//")) {
    return safeFallback;
  }

  try {
    const base = new URL(SITE_URL);
    const parsed = new URL(trimmed, base);
    if (parsed.origin !== base.origin) {
      return safeFallback;
    }

    const value = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!parsed.pathname.startsWith("/admin")) {
      return safeFallback;
    }
    if (isAdminBridgePublicPath(parsed.pathname)) {
      return safeFallback;
    }
    return value;
  } catch {
    return safeFallback;
  }
}

/**
 * The admin session (12h by default) is minted from the member session (7d).
 * Promotion to admin is a sensitive step like account deletion or binding an
 * email, so it uses the same recent-auth rule: a credential check within the
 * last 10 minutes. Re-entering the password through the member login is the
 * proof otherwise, which also covers members without a password. Tokens
 * issued before `authenticatedAt` existed, and future or non-finite times,
 * fail closed.
 */
export function isMemberSessionFreshForAdminBridge(
  session: { authenticatedAt?: number },
  now = Date.now(),
) {
  return isMemberAuthenticationRecent(session.authenticatedAt, now);
}

export function isAdminAccountEligibleForSessionBridge(
  account: BridgeEligibleAdminAccount | null | undefined,
) {
  return Boolean(
    account?.isActive &&
      !account.mustChangePassword,
  );
}

export async function resolveAdminAccountFromUserSession(userId: string) {
  const account = await getAdminAccountById(userId);
  if (!isAdminAccountEligibleForSessionBridge(account)) {
    return null;
  }

  return account;
}
