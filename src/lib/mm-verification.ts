import crypto from "crypto";
import { createHmacDigest } from "./hmac.js";

function getSecret() {
  const secret = process.env.MM_VERIFICATION_SECRET ?? process.env.USER_SESSION_SECRET ?? "";
  if (!secret) {
    throw new Error(
      "MM_VERIFICATION_SECRET 또는 USER_SESSION_SECRET 환경 변수가 필요합니다.",
    );
  }
  if (secret.length < 32) {
    throw new Error("MM_VERIFICATION_SECRET는 최소 32자 이상이어야 합니다.");
  }
  return secret;
}

export function generateCode() {
  return crypto.randomInt(0, 36 ** 6).toString(36).padStart(6, "0").toUpperCase();
}

export function hashCode(code: string) {
  return createHmacDigest(code, getSecret(), "hex");
}
