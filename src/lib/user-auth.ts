import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "user_session";
const SESSION_TTL_DAYS = 7;

function getSecret() {
  const secret = process.env.USER_SESSION_SECRET;
  if (!secret) {
    throw new Error("USER_SESSION_SECRET 환경 변수가 필요합니다.");
  }
  if (secret.length < 32) {
    throw new Error("USER_SESSION_SECRET는 최소 32자 이상이어야 합니다.");
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
    return null;
  }
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
  const ok = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
  if (!ok) {
    return null;
  }
  try {
    return JSON.parse(payload) as {
      userId: string;
      issuedAt: number;
      mustChangePassword?: boolean;
    };
  } catch {
    return null;
  }
}

export async function setUserSession(userId: string, mustChangePassword = false) {
  const payload = JSON.stringify({
    userId,
    mustChangePassword,
    issuedAt: Date.now(),
  });
  const token = signPayload(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function clearUserSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getUserSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifyToken(token);
}
