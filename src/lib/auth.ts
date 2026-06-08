import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createHmacDigest,
  splitSignedToken,
  verifyHmacDigest,
} from "./hmac.js";
import { getAdminSessionTtlSeconds } from "./admin-security";
import {
  authenticateAdminCredentials,
  getAdminAccountById,
  type AdminAccount,
} from "./admin-accounts";

const COOKIE_NAME = "admin_session";

type AdminSessionPayload = {
  issuedAt: number;
  expiresAt: number;
  adminId: string;
  loginId: string;
  permissionVersion: number;
};

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET 환경 변수가 필요합니다.");
  }
  if (secret.length < 32) {
    throw new Error(
      "ADMIN_SESSION_SECRET는 최소 32자 이상의 난수여야 합니다.",
    );
  }
  return secret;
}

function signPayload(payload: string) {
  const secret = getSecret();
  const signature = createHmacDigest(payload, secret, "hex");
  return `${payload}.${signature}`;
}

function parseAdminSessionToken(token: string): AdminSessionPayload | null {
  const signedToken = splitSignedToken(token);
  if (!signedToken) {
    return null;
  }
  const [payload, signature] = signedToken;
  if (!payload || !signature) {
    return null;
  }
  if (!verifyHmacDigest(payload, signature, getSecret(), "hex")) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as Partial<AdminSessionPayload>;
    if (
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.adminId !== "string" ||
      parsed.adminId.length === 0 ||
      typeof parsed.loginId !== "string" ||
      parsed.loginId.length === 0 ||
      typeof parsed.permissionVersion !== "number"
    ) {
      return null;
    }
    if (!(parsed.expiresAt > Date.now() && parsed.issuedAt <= Date.now())) {
      return null;
    }
    return {
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
      adminId: parsed.adminId,
      loginId: parsed.loginId,
      permissionVersion: parsed.permissionVersion,
    };
  } catch {
    return null;
  }
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
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ttlSeconds,
    path: "/",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAdminSession() {
  return (await getAdminSession()) !== null;
}

export async function getAdminSession(): Promise<{
  adminId: string;
  loginId: string;
  issuedAt: number;
  expiresAt: number;
  permissionVersion: number;
  account: AdminAccount;
} | null> {
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
}

export async function requireAdmin() {
  const ok = await isAdminSession();
  if (!ok) {
    redirect("/admin/login");
  }
}

export async function validateAdminCredentials(id: string, password: string) {
  return authenticateAdminCredentials(id, password);
}
