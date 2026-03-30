import crypto from "crypto";
import { SITE_URL } from "@/lib/site";
import { CERTIFICATION_QR_TTL_SECONDS } from "@/lib/certification-constants";

export type CertificationQrPayload = {
  version: 1;
  userId: string;
  mmUsername: string;
  displayName?: string | null;
  year?: number | null;
  campus?: string | null;
  classNumber?: number | null;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

export type CertificationQrVerificationResult =
  | { ok: true; payload: CertificationQrPayload }
  | { ok: false; reason: "invalid" | "expired" };

function getSecret() {
  const secret =
    process.env.CERTIFICATION_QR_SECRET ?? process.env.USER_SESSION_SECRET ?? "";
  if (!secret) {
    throw new Error(
      "CERTIFICATION_QR_SECRET 또는 USER_SESSION_SECRET 환경 변수가 필요합니다.",
    );
  }
  if (secret.length < 32) {
    throw new Error("QR 검증 시크릿은 최소 32자 이상이어야 합니다.");
  }
  return secret;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function issueCertificationQrToken(input: {
  userId: string;
  mmUsername: string;
  displayName?: string | null;
  year?: number | null;
  campus?: string | null;
  classNumber?: number | null;
}) {
  const now = Date.now();
  const payload: CertificationQrPayload = {
    version: 1,
    userId: input.userId,
    mmUsername: input.mmUsername,
    displayName: input.displayName ?? null,
    year: input.year ?? null,
    campus: input.campus ?? null,
    classNumber: input.classNumber ?? null,
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
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return { ok: false, reason: "invalid" };
  }

  const expected = sign(encodedPayload);
  if (expected.length !== signature.length) {
    return { ok: false, reason: "invalid" };
  }
  const isValidSignature = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
  if (!isValidSignature) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const payload = JSON.parse(
      decodeBase64Url(encodedPayload),
    ) as CertificationQrPayload;
    if (
      payload.version !== 1 ||
      typeof payload.userId !== "string" ||
      typeof payload.mmUsername !== "string" ||
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
