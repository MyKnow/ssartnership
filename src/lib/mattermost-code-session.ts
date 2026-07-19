import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createHmacDigest, splitSignedToken, verifyHmacDigest } from "@/lib/hmac.js";
import {
  normalizeMattermostSignupParseReason,
  type MattermostSignupMode,
  type MattermostSignupParseReason,
} from "@/lib/mm-signup-approval";
import { isUuid } from "@/lib/uuid";

const COOKIE_NAME = "mattermost_code_session";
const SESSION_TTL_MS = 20 * 60 * 1000;

export type MattermostCodeSessionPurpose = "signup" | "reset_password";

export type MattermostCodeSession = {
  purpose: MattermostCodeSessionPurpose;
  mmUserId: string;
  mmUsername: string;
  displayName: string;
  subjectGeneration: number;
  senderGeneration: number;
  signupMode?: MattermostSignupMode;
  parseExclusionReason?: MattermostSignupParseReason | null;
  signupUploadOwnerId?: string;
};

type SignedMattermostCodeSession = MattermostCodeSession & {
  issuedAt: number;
  expiresAt: number;
};

function getSecret() {
  const secret = process.env.USER_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("USER_SESSION_SECRET 환경 변수가 필요합니다.");
  }
  return secret;
}

function parseSessionPayload(value: unknown): SignedMattermostCodeSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const payload = value as Record<string, unknown>;
  if (
    (payload.purpose !== "signup" && payload.purpose !== "reset_password")
    || typeof payload.mmUserId !== "string"
    || !payload.mmUserId
    || typeof payload.mmUsername !== "string"
    || !payload.mmUsername
    || typeof payload.displayName !== "string"
    || !payload.displayName
    || !Number.isSafeInteger(payload.subjectGeneration)
    || (payload.subjectGeneration as number) < 0
    || !Number.isSafeInteger(payload.senderGeneration)
    || (payload.senderGeneration as number) < 1
    || typeof payload.issuedAt !== "number"
    || typeof payload.expiresAt !== "number"
    || (payload.issuedAt as number) > Date.now()
    || (payload.expiresAt as number) <= Date.now()
  ) {
    return null;
  }
  if (payload.purpose === "signup" && !isUuid(String(payload.signupUploadOwnerId ?? ""))) {
    return null;
  }
  const signupMode = payload.purpose === "signup"
    ? payload.signupMode === "approval"
      ? "approval"
      : "direct"
    : undefined;
  const parseExclusionReason = payload.purpose === "signup"
    ? normalizeMattermostSignupParseReason(payload.parseExclusionReason)
    : null;
  return {
    ...payload,
    ...(signupMode ? { signupMode } : {}),
    ...(parseExclusionReason ? { parseExclusionReason } : {}),
    ...(payload.purpose === "signup"
      ? { signupUploadOwnerId: payload.signupUploadOwnerId as string }
      : {}),
  } as SignedMattermostCodeSession;
}

function verifySessionToken(token: string) {
  const split = splitSignedToken(token);
  if (!split) {
    return null;
  }
  const [payload, signature] = split;
  if (!payload || !signature || !verifyHmacDigest(payload, signature, getSecret(), "hex")) {
    return null;
  }
  try {
    return parseSessionPayload(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}

export async function setMattermostCodeSession(session: MattermostCodeSession) {
  if (session.purpose === "signup" && !isUuid(session.signupUploadOwnerId ?? "")) {
    throw new Error("signupUploadOwnerId가 필요합니다.");
  }
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({
    ...session,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  }), "utf8").toString("base64url");
  const token = `${payload}.${createHmacDigest(payload, getSecret(), "hex")}`;
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
}

export async function getMattermostCodeSession(
  purpose: MattermostCodeSessionPurpose,
) {
  noStore();
  const store = await cookies();
  const session = verifySessionToken(store.get(COOKIE_NAME)?.value ?? "");
  return session?.purpose === purpose ? session : null;
}

export async function clearMattermostCodeSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
