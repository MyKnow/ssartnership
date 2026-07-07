import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createHmacDigest, splitSignedToken, verifyHmacDigest } from "@/lib/hmac.js";
import type { SsafySignupSessionData } from "./signup";

const COOKIE_NAME = "ssafy_signup_session";
const SESSION_TTL_MINUTES = 20;
const SESSION_TTL_MS = SESSION_TTL_MINUTES * 60 * 1000;

type SignedSignupSession = SsafySignupSessionData & {
  issuedAt: number;
  expiresAt: number;
};

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
  return `${payload}.${createHmacDigest(payload, getSecret(), "hex")}`;
}

function encodePayload(payload: SignedSignupSession) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(payload: string) {
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isOptionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || isNullableString(value);
}

function parseSessionPayload(value: unknown): SignedSignupSession | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const payload = value as Record<string, unknown>;
  if (
    !isString(payload.sub) ||
    !isString(payload.mattermostUserId) ||
    !isString(payload.mattermostUsername) ||
    !isString(payload.displayName) ||
    !isNullableString(payload.campus) ||
    !isOptionalNullableString(payload.track) ||
    !isOptionalNullableString(payload.trackName) ||
    !isNullableString(payload.verificationId) ||
    !isNullableString(payload.scope) ||
    (payload.avatarUrl !== undefined && !isNullableString(payload.avatarUrl)) ||
    typeof payload.isStaff !== "boolean" ||
    typeof payload.authTime !== "number" ||
    typeof payload.issuedAt !== "number" ||
    typeof payload.expiresAt !== "number" ||
    !Array.isArray(payload.sourceYears)
  ) {
    return null;
  }
  const cohort =
    typeof payload.cohort === "number" && Number.isInteger(payload.cohort)
      ? payload.cohort
      : null;
  const sourceYears = payload.sourceYears.filter(
    (year): year is number =>
      typeof year === "number" && Number.isInteger(year) && year >= 0 && year <= 99,
  );

  if (payload.expiresAt <= Date.now() || payload.issuedAt > Date.now()) {
    return null;
  }

  return {
    sub: payload.sub,
    mattermostUserId: payload.mattermostUserId,
    mattermostUsername: payload.mattermostUsername,
    displayName: payload.displayName,
    cohort,
    campus: payload.campus,
    track: payload.track ?? null,
    trackName: payload.trackName ?? null,
    isStaff: payload.isStaff,
    sourceYears,
    avatarUrl: payload.avatarUrl ?? null,
    authTime: payload.authTime,
    verificationId: payload.verificationId,
    scope: payload.scope,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}

function verifyToken(token: string) {
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
  return parseSessionPayload(decodePayload(payload));
}

export async function getSsafySignupSession() {
  noStore();
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  const session = verifyToken(token);
  if (!session) {
    return null;
  }
  return {
    sub: session.sub,
    mattermostUserId: session.mattermostUserId,
    mattermostUsername: session.mattermostUsername,
    displayName: session.displayName,
    cohort: session.cohort,
    campus: session.campus,
    track: session.track,
    trackName: session.trackName,
    isStaff: session.isStaff,
    sourceYears: session.sourceYears,
    avatarUrl: session.avatarUrl,
    authTime: session.authTime,
    verificationId: session.verificationId,
    scope: session.scope,
  };
}

export async function setSsafySignupSession(data: SsafySignupSessionData) {
  const now = Date.now();
  const payload = encodePayload({
    ...data,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  const store = await cookies();
  store.set(COOKIE_NAME, signPayload(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MINUTES * 60,
    path: "/",
  });
}

export async function clearSsafySignupSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
