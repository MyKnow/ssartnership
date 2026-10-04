import { getAdminAccountById, type AdminAccount } from "@/lib/admin-accounts";
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
 * Without an age limit the bridge would silently re-issue admin access for
 * the whole member session lifetime, so the member credential must itself be
 * no older than one admin session TTL. Future or non-finite timestamps fail
 * closed.
 */
export function isMemberSessionFreshForAdminBridge(
  session: { issuedAt: number; authenticatedAt?: number },
  ttlSeconds: number,
  now = Date.now(),
) {
  // Prefer the credential time; tokens issued before it existed fall back to
  // the issue time, which is never earlier than the credential check.
  const authenticatedAt = session.authenticatedAt ?? session.issuedAt;
  if (!Number.isFinite(authenticatedAt) || authenticatedAt > now) {
    return false;
  }
  return now - authenticatedAt <= ttlSeconds * 1000;
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
