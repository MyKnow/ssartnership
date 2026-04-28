import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import {
  createHmacDigest,
  splitSignedToken,
  verifyHmacDigest,
} from "./hmac.js";

const COOKIE_NAME = "admin_session";
const SESSION_TTL_DAYS = 7;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

type AdminSessionPayload = {
  issuedAt: number;
  expiresAt: number;
  adminId: string;
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
      parsed.adminId.length === 0
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
    };
  } catch {
    return null;
  }
}

export async function setAdminSession(adminId: string) {
  const now = Date.now();
  const payload = JSON.stringify({
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
    adminId,
  });
  const token = signPayload(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
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
  issuedAt: number;
  expiresAt: number;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  try {
    return parseAdminSessionToken(token);
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

export function validateAdminCredentials(id: string, password: string) {
  const expectedId = process.env.ADMIN_ID ?? "";
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "";
  const safeCompare = (a: string, b: string) => {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    if (aBuffer.length !== bBuffer.length) {
      const max = Math.max(aBuffer.length, bBuffer.length);
      const paddedA = Buffer.concat([aBuffer, Buffer.alloc(max - aBuffer.length)]);
      const paddedB = Buffer.concat([bBuffer, Buffer.alloc(max - bBuffer.length)]);
      crypto.timingSafeEqual(paddedA, paddedB);
      return false;
    }
    return crypto.timingSafeEqual(aBuffer, bBuffer);
  };

  return safeCompare(id, expectedId) && safeCompare(password, expectedPassword);
}
