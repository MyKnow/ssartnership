import crypto from "crypto";
import {
  createHmacDigest,
  splitSignedToken,
  verifyHmacDigest,
} from "./hmac.js";
import type { ResetPasswordCodeRow } from "@/app/api/mm/_shared/reset-password-code-store";

const TOKEN_TTL_MS = 5 * 60 * 1000;

export type ResetPasswordCompletionTokenPayload = {
  version: 1;
  mmUserId: string;
  mmUsername: string;
  codeId: string;
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
      parsed.version !== 1 ||
      typeof parsed.mmUserId !== "string" ||
      typeof parsed.mmUsername !== "string" ||
      typeof parsed.codeId !== "string" ||
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
  codeRow: ResetPasswordCodeRow;
}) {
  const now = Date.now();
  const payload: ResetPasswordCompletionTokenPayload = {
    version: 1,
    mmUserId: input.codeRow.mm_user_id,
    mmUsername: input.codeRow.mm_username,
    codeId: input.codeRow.id,
    issuedAt: now,
    expiresAt: new Date(input.codeRow.expires_at).getTime() || now + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(12).toString("base64url"),
  };
  const encoded = JSON.stringify(payload);
  return signPayload(encoded);
}

export function verifyResetPasswordCompletionToken(token: string) {
  return parsePayload(token);
}
