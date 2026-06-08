import { getAdminAccountByLoginId, type AdminAccount } from "@/lib/admin-accounts";
import { SITE_URL } from "@/lib/site";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const ADMIN_BRIDGE_FALLBACK = "/admin";
const ADMIN_BRIDGE_PUBLIC_PATHS = [
  "/admin/login",
  "/admin/setup",
  "/admin/session",
  "/admin/denied",
];

type BridgeEligibleAdminAccount = Pick<
  AdminAccount,
  "isActive" | "mustChangePassword" | "initialSetupCompletedAt"
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

export function isAdminAccountEligibleForSessionBridge(
  account: BridgeEligibleAdminAccount | null | undefined,
) {
  return Boolean(
    account?.isActive &&
      !account.mustChangePassword &&
      account.initialSetupCompletedAt,
  );
}

export async function resolveAdminAccountFromUserSession(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("mm_username")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.mm_username) {
    return null;
  }

  const account = await getAdminAccountByLoginId(data.mm_username);
  if (!isAdminAccountEligibleForSessionBridge(account)) {
    return null;
  }

  return account;
}
