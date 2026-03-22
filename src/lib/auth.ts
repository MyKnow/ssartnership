import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";

const COOKIE_NAME = "admin_session";
const SESSION_TTL_DAYS = 7;

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
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

function verifyToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}

export async function setAdminSession() {
  const payload = JSON.stringify({
    issuedAt: Date.now(),
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
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return false;
  }
  try {
    return verifyToken(token);
  } catch {
    return false;
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
  return id === expectedId && password === expectedPassword;
}
