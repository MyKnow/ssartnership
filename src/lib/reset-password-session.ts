import crypto from "crypto";
import {
  createHmacDigest,
  splitSignedToken,
  verifyHmacDigest,
} from "./hmac.js";

const TOKEN_TTL_MS = 5 * 60 * 1000;

export const RESET_PASSWORD_COMPLETION_COOKIE_NAME = "reset_password_completion";
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
  const secret = process.env.RESET_PASSWORD_SESSION_SECRET ?? process.env.USER_SESSION_SECRET;
  if (!secret) {
    throw new Error("RESET_PASSWORD_SESSION_SECRET 또는 USER_SESSION_SECRET 환경 변수가 필요합니다.");
  }
  if (secret.length < 32) {
    throw new Error("RESET_PASSWORD_SESSION_SECRET는 최소 32자 이상이어야 합니다.");
  }
  return secret;
}

function signPayload(payload: string) {
  const secret = getSecret();
  const signature = createHmacDigest(payload, secret, "hex");
  return `${payload}.${signature}`;
}

function parsePayload(token: string) {
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

export function encodeResetPasswordCompletionCookieValue(token: string) {
  return encodeURIComponent(token);
}

export function decodeResetPasswordCompletionCookieValue(
  value: string | null | undefined,
) {
  if (!value) {
    return "";
  }
  let decoded = value.trim();
  try {
    for (let index = 0; index < 3; index += 1) {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) {
        return decoded;
      }
      decoded = nextDecoded;
    }
    return decoded;
  } catch {
    return "";
  }
}

export function readResetPasswordCompletionTokenFromCookieHeader(
  cookieHeader: string | null,
) {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }
    const name = part.slice(0, separatorIndex).trim();
    if (name !== RESET_PASSWORD_COMPLETION_COOKIE_NAME) {
      continue;
    }
    const value = part.slice(separatorIndex + 1);
    const token = decodeResetPasswordCompletionCookieValue(value);
    return token || null;
  }

  return null;
}

export function getResetPasswordCompletionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: RESET_PASSWORD_COMPLETION_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  };
}

export function getClearResetPasswordCompletionCookieOptions() {
  return {
    ...getResetPasswordCompletionCookieOptions(),
    maxAge: 0,
  };
}
