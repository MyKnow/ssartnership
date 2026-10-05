import crypto from "crypto";
import { openSignedPayload, signPayloadWith } from "./hmac.js";
import { buildSessionCookieOptions } from "./session-cookies.ts";
import { readSessionSecret } from "./session-secrets.ts";

const TOKEN_TTL_MS = 5 * 60 * 1000;
export const RESET_PASSWORD_COMPLETION_COOKIE_NAME =
  "ssartnership_reset_completion";
export const RESET_PASSWORD_COMPLETION_COOKIE_MAX_AGE_SECONDS =
  TOKEN_TTL_MS / 1000;

export type ResetPasswordCompletionTokenPayload = {
  version: 2;
  memberId: string;
  mmUserId: string;
  mmUsername: string;
  memberUpdatedAt: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function getSecret() {
  return readSessionSecret("reset-password-completion");
}

function signPayload(payload: string) {
  return signPayloadWith(payload, getSecret(), "hex");
}

function parsePayload(token: string) {
  const payload = openSignedPayload(token, getSecret(), "hex");
  if (!payload) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as Partial<ResetPasswordCompletionTokenPayload>;
    if (
      parsed.version !== 2 ||
      typeof parsed.memberId !== "string" ||
      typeof parsed.mmUserId !== "string" ||
      typeof parsed.mmUsername !== "string" ||
      typeof parsed.memberUpdatedAt !== "string" ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.nonce !== "string"
    ) {
      return null;
    }
    if (parsed.issuedAt > Date.now() || parsed.expiresAt <= Date.now()) {
      return null;
    }
    return parsed as ResetPasswordCompletionTokenPayload;
  } catch {
    return null;
  }
}

export function issueResetPasswordCompletionToken(input: {
  memberId: string;
  mmUserId: string;
  mmUsername: string;
  memberUpdatedAt: string;
}) {
  const now = Date.now();
  const payload: ResetPasswordCompletionTokenPayload = {
    version: 2,
    memberId: input.memberId,
    mmUserId: input.mmUserId,
    mmUsername: input.mmUsername,
    memberUpdatedAt: input.memberUpdatedAt,
    issuedAt: now,
    expiresAt: now + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(12).toString("base64url"),
  };
  const encoded = JSON.stringify(payload);
  return signPayload(encoded);
}

export function verifyResetPasswordCompletionToken(token: string) {
  return parsePayload(token);
}

export function getResetPasswordCompletionCookieOptions(
  maxAge = RESET_PASSWORD_COMPLETION_COOKIE_MAX_AGE_SECONDS,
) {
  return buildSessionCookieOptions(maxAge);
}

export function decodeResetPasswordCompletionCookieValue(rawValue: string) {
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

export function extractResetPasswordCompletionTokenFromCookieHeader(
  cookieHeader: string | null,
) {
  if (!cookieHeader) {
    return "";
  }

  const prefix = `${RESET_PASSWORD_COMPLETION_COOKIE_NAME}=`;
  const rawValue = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);

  if (!rawValue) {
    return "";
  }

  return decodeResetPasswordCompletionCookieValue(rawValue);
}
