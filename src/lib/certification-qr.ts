import crypto from "crypto";
import { SITE_URL } from "@/lib/site";
import { CERTIFICATION_QR_TTL_SECONDS } from "@/lib/certification-constants";
import { createHmacDigest, openSignedPayload } from "./hmac.js";
import { readSessionSecret } from "./session-secrets.ts";

export type CertificationQrPayload = {
  version: 1;
  userId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

export type CertificationQrVerificationResult =
  | { ok: true; payload: CertificationQrPayload }
  | { ok: false; reason: "invalid" | "expired" };

function getSecret() {
  return readSessionSecret("certification-qr");
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmacDigest(value, getSecret(), "base64url");
}

export function issueCertificationQrToken(input: {
  userId: string;
}) {
  const now = Date.now();
  const payload: CertificationQrPayload = {
    version: 1,
    userId: input.userId,
    issuedAt: now,
    expiresAt: now + CERTIFICATION_QR_TTL_SECONDS * 1000,
    nonce: crypto.randomBytes(12).toString("base64url"),
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    payload,
  };
}

export function verifyCertificationQrToken(
  token: string,
): CertificationQrVerificationResult {
  const encodedPayload = openSignedPayload(token, getSecret(), "base64url");
  if (!encodedPayload) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const payload = JSON.parse(
      decodeBase64Url(encodedPayload),
    ) as CertificationQrPayload;
    if (
      payload.version !== 1 ||
      typeof payload.userId !== "string" ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      typeof payload.nonce !== "string"
    ) {
      return { ok: false, reason: "invalid" };
    }
    if (payload.expiresAt <= Date.now() || payload.issuedAt > Date.now()) {
      return { ok: false, reason: "expired" };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function getCertificationQrVerificationUrl(token: string) {
  return new URL(`/verify/${encodeURIComponent(token)}`, SITE_URL).toString();
}
