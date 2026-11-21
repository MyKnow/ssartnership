import { randomInt } from "node:crypto";
import { createHmacDigest, verifyHmacDigest } from "@/lib/hmac.js";
import { normalizeMemberEmail } from "@/lib/member-domain";
import { readSessionSecret } from "@/lib/session-secrets";
export {
  MEMBER_EMAIL_RESEND_COOLDOWN_SECONDS,
  MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS,
} from "@/lib/member-email-verification-timing";

export function getMemberEmailVerificationSecret() {
  return readSessionSecret("member-email-verification", {
    errorMessage: "회원 이메일 인증용 HMAC 비밀값이 필요합니다.",
  });
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
