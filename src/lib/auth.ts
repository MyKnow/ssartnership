import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { signPayloadWith } from "./hmac.js";
import {
  ADMIN_SESSION_COOKIE_NAME,
  buildSessionCookieOptions,
} from "./session-cookies.ts";
import { readSessionSecret } from "./session-secrets.ts";
import {
  parseAdminSessionToken as parseSignedAdminSessionToken,
  type AdminSessionTokenPayload,
} from "./session-tokens.ts";
import { getAdminSessionTtlSeconds } from "./admin-security";
import {
  authenticateAdminCredentials,
  getAdminAccountById,
  type AdminAccount,
} from "./admin-accounts";

const COOKIE_NAME = ADMIN_SESSION_COOKIE_NAME;

type AdminSessionPayload = AdminSessionTokenPayload;

function getSecret() {
  return readSessionSecret("admin-session");
}

function signPayload(payload: string) {
  return signPayloadWith(payload, getSecret(), "hex");
}

function parseAdminSessionToken(token: string): AdminSessionPayload | null {
  return parseSignedAdminSessionToken(token, getSecret());
}

export async function setAdminSession(account: Pick<AdminAccount, "id" | "loginId" | "permissionVersion">) {
  const now = Date.now();
  const ttlSeconds = getAdminSessionTtlSeconds();
  const ttlMs = ttlSeconds * 1000;
  const payload = JSON.stringify({
    issuedAt: now,
    expiresAt: now + ttlMs,
    adminId: account.id,
    loginId: account.loginId,
    permissionVersion: account.permissionVersion,
  });
  const token = signPayload(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, buildSessionCookieOptions(ttlSeconds));
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAdminSession() {
  return (await getAdminSession()) !== null;
}

export type AdminSession = {
  adminId: string;
  loginId: string;
  issuedAt: number;
  expiresAt: number;
  permissionVersion: number;
  account: AdminAccount;
};

export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  try {
    const payload = parseAdminSessionToken(token);
    if (!payload) {
      return null;
    }
    const account = await getAdminAccountById(payload.adminId);
    if (
      !account ||
      !account.isActive ||
      account.mustChangePassword ||
      account.permissionVersion !== payload.permissionVersion
    ) {
      return null;
    }
    return {
      ...payload,
      account,
    };
  } catch {
    return null;
  }
});

export async function requireAdmin() {
  const ok = await isAdminSession();
  if (!ok) {
    redirect("/auth/login?returnTo=%2Fadmin");
  }
}

export async function validateAdminCredentials(id: string, password: string) {
  return authenticateAdminCredentials(id, password);
}
