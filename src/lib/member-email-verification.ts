import { randomInt } from "node:crypto";
import { createHmacDigest, verifyHmacDigest } from "@/lib/hmac.js";
import { normalizeMemberEmail } from "@/lib/member-domain";

export const MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS = 10 * 60;

export function getMemberEmailVerificationSecret() {
  const secret =
    process.env.MEMBER_EMAIL_VERIFICATION_HMAC_SECRET
    ?? process.env.MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET
    ?? process.env.GRADUATE_VERIFICATION_HMAC_SECRET
    ?? process.env.USER_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("회원 이메일 인증용 HMAC 비밀값이 필요합니다.");
  }
  return secret;
}

function requireNormalizedMemberEmail(value: string) {
  const email = normalizeMemberEmail(value);
  if (!email) {
    throw new Error("이메일 주소를 확인해 주세요.");
  }
  return email;
}

export function generateMemberEmailVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashMemberEmailIdentifier(email: string) {
  return createHmacDigest(
    `member-email:${requireNormalizedMemberEmail(email)}`,
    getMemberEmailVerificationSecret(),
    "hex",
  );
}

export function hashMemberEmailVerificationCode(email: string, code: string) {
  const payload = `member-email-code:${requireNormalizedMemberEmail(email)}:${code.trim()}`;
  return createHmacDigest(
    payload,
    getMemberEmailVerificationSecret(),
    "hex",
  );
}

export function verifyMemberEmailVerificationCodeHash(
  email: string,
  code: string,
  expectedHash: string,
) {
  const payload = `member-email-code:${requireNormalizedMemberEmail(email)}:${code.trim()}`;
  return verifyHmacDigest(
    payload,
    expectedHash,
    getMemberEmailVerificationSecret(),
    "hex",
  );
}
