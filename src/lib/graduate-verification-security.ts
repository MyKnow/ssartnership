import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import {
  createHmacDigest,
  splitSignedToken,
  verifyHmacDigest,
} from "@/lib/hmac.js";
import {
  getGraduateVerificationSecret,
} from "@/lib/graduate-verification-crypto";
import {
  parseGraduateVerificationRequestKind,
  type GraduateVerificationRequestKind,
} from "@/lib/graduate-verification";

export {
  generateGraduateEmailCode,
  hashGraduateDocumentNumber,
  hashGraduateEmailCode,
  hashGraduateEmailIdentifier,
  hashGraduateSensitiveValue,
} from "@/lib/graduate-verification-crypto";

const APPLICATION_SESSION_COOKIE = "graduate_application_session";
const PASSWORD_RESET_SESSION_COOKIE = "graduate_password_reset_session";
const APPLICATION_SESSION_TTL_MS = 30 * 60 * 1000;

type GraduateApplicationSession = {
  challengeId: string;
  requestKind?: GraduateVerificationRequestKind;
  issuedAt: number;
  expiresAt: number;
};

function toBase64UrlJson(value: GraduateApplicationSession) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function parseApplicationSessionToken(token: string | undefined) {
  if (!token) return null;
  const parts = splitSignedToken(token);
  if (!parts) return null;
  const [payload, signature] = parts;
  if (!verifyHmacDigest(payload, signature, getGraduateVerificationSecret(), "hex")) {
    return null;
  }
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GraduateApplicationSession;
    if (
      !value ||
      typeof value.challengeId !== "string" ||
      (value.requestKind !== undefined &&
        !parseGraduateVerificationRequestKind(value.requestKind)) ||
      typeof value.issuedAt !== "number" ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt <= Date.now() ||
      value.issuedAt > Date.now()
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

async function setGraduateChallengeSession(
  cookieName: string,
  challengeId: string,
  requestKind?: GraduateVerificationRequestKind,
) {
  const issuedAt = Date.now();
  const payload = toBase64UrlJson({
    challengeId,
    ...(requestKind ? { requestKind } : {}),
    issuedAt,
    expiresAt: issuedAt + APPLICATION_SESSION_TTL_MS,
  });
  const signature = createHmacDigest(payload, getGraduateVerificationSecret(), "hex");
  const store = await cookies();
  store.set(cookieName, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(APPLICATION_SESSION_TTL_MS / 1000),
    path: "/",
  });
}

async function getGraduateChallengeSession(cookieName: string) {
  noStore();
  const store = await cookies();
  return parseApplicationSessionToken(store.get(cookieName)?.value);
}

async function clearGraduateChallengeSession(cookieName: string) {
  const store = await cookies();
  store.delete(cookieName);
}

export async function setGraduateApplicationSession(
  challengeId: string,
  requestKind: GraduateVerificationRequestKind,
) {
  return setGraduateChallengeSession(
    APPLICATION_SESSION_COOKIE,
    challengeId,
    requestKind,
  );
}

export async function getGraduateApplicationSession() {
  return getGraduateChallengeSession(APPLICATION_SESSION_COOKIE);
}

export async function clearGraduateApplicationSession() {
  return clearGraduateChallengeSession(APPLICATION_SESSION_COOKIE);
}

export async function setGraduatePasswordResetSession(challengeId: string) {
  return setGraduateChallengeSession(PASSWORD_RESET_SESSION_COOKIE, challengeId);
}

export async function getGraduatePasswordResetSession() {
  return getGraduateChallengeSession(PASSWORD_RESET_SESSION_COOKIE);
}

export async function clearGraduatePasswordResetSession() {
  return clearGraduateChallengeSession(PASSWORD_RESET_SESSION_COOKIE);
}

export const GRADUATE_APPLICATION_SESSION_TTL_MS = APPLICATION_SESSION_TTL_MS;
