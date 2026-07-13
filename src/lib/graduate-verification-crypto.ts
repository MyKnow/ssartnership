import { randomInt } from "node:crypto";
import { createHmacDigest } from "@/lib/hmac.js";
import {
  normalizeGraduateDocumentNumber,
  normalizeGraduateEmail,
} from "@/lib/graduate-verification";

export function getGraduateVerificationSecret() {
  const secret = process.env.GRADUATE_VERIFICATION_HMAC_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("GRADUATE_VERIFICATION_HMAC_SECRET는 최소 32자 이상이어야 합니다.");
  }
  return secret;
}

export function generateGraduateEmailCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashGraduateSensitiveValue(value: string) {
  return createHmacDigest(value, getGraduateVerificationSecret(), "hex");
}

export function hashGraduateEmailIdentifier(value: string) {
  return hashGraduateSensitiveValue(`email:${normalizeGraduateEmail(value)}`);
}

export function hashGraduateEmailCode(email: string, code: string) {
  return hashGraduateSensitiveValue(
    `email-code:${normalizeGraduateEmail(email)}:${code.trim()}`,
  );
}

export function hashGraduateDocumentNumber(value: string) {
  const normalized = normalizeGraduateDocumentNumber(value);
  if (!normalized) {
    throw new Error("수료증 문서 번호를 확인해 주세요.");
  }
  return hashGraduateSensitiveValue(`certificate-document:${normalized}`);
}
