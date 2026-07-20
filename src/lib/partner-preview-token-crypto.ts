import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { isValidPartnerPreviewToken } from "@/lib/partner-preview";

const TOKEN_KEY_VERSION = 1;
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export type EncryptedPartnerPreviewToken = {
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: number;
};

function getEncryptionSecret() {
  const secret =
    process.env.PARTNER_PREVIEW_TOKEN_ENCRYPTION_SECRET?.trim()
    || process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "PARTNER_PREVIEW_TOKEN_ENCRYPTION_SECRET 또는 ADMIN_SESSION_SECRET 환경 변수가 필요합니다.",
    );
  }
  if (secret.length < 32) {
    throw new Error(
      "미리보기 링크 암호화 시크릿은 최소 32자 이상의 난수여야 합니다.",
    );
  }
  return secret;
}

function deriveKey(secret: string) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error(
      "미리보기 링크 암호화 시크릿은 최소 32자 이상의 난수여야 합니다.",
    );
  }
  return createHash("sha256")
    .update("ssartnership:partner-preview-token:v1:", "utf8")
    .update(secret, "utf8")
    .digest();
}

function getAssociatedData(partnerId: string) {
  const normalizedPartnerId = partnerId.trim();
  if (!normalizedPartnerId) {
    throw new Error("미리보기 링크 대상 제휴처가 올바르지 않습니다.");
  }
  return Buffer.from(`partner-preview-token:v${TOKEN_KEY_VERSION}:${normalizedPartnerId}`, "utf8");
}

function decodeBase64(value: string, label: string, expectedLength?: number) {
  if (
    typeof value !== "string"
    || !value
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
    || value.length % 4 === 1
  ) {
    throw new Error(`${label} 형식이 올바르지 않습니다.`);
  }

  const decoded = Buffer.from(value, "base64");
  if (expectedLength !== undefined && decoded.length !== expectedLength) {
    throw new Error(`${label} 길이가 올바르지 않습니다.`);
  }
  if (decoded.length === 0) {
    throw new Error(`${label}이 비어 있습니다.`);
  }
  return decoded;
}

function validateToken(partnerId: string, token: string) {
  const normalizedToken = token.trim();
  getAssociatedData(partnerId);
  if (!isValidPartnerPreviewToken(normalizedToken)) {
    throw new Error("미리보기 링크 토큰 형식이 올바르지 않습니다.");
  }
  return normalizedToken;
}

export function encryptPartnerPreviewToken(
  partnerId: string,
  token: string,
  secret = getEncryptionSecret(),
): EncryptedPartnerPreviewToken {
  const normalizedToken = validateToken(partnerId, token);
  const key = deriveKey(secret);
  const associatedData = getAssociatedData(partnerId);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(associatedData);
  const ciphertext = Buffer.concat([
    cipher.update(normalizedToken, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    nonce: nonce.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: TOKEN_KEY_VERSION,
  };
}

export function decryptPartnerPreviewToken(
  partnerId: string,
  encrypted: EncryptedPartnerPreviewToken,
  secret = getEncryptionSecret(),
) {
  const key = deriveKey(secret);
  const associatedData = getAssociatedData(partnerId);

  try {
    if (encrypted.keyVersion !== TOKEN_KEY_VERSION) {
      throw new Error("unsupported token key version");
    }
    const nonce = decodeBase64(encrypted.nonce, "미리보기 링크 nonce", NONCE_BYTES);
    const authTag = decodeBase64(encrypted.authTag, "미리보기 링크 auth tag", AUTH_TAG_BYTES);
    const ciphertext = decodeBase64(encrypted.ciphertext, "미리보기 링크 ciphertext");
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(associatedData);
    decipher.setAuthTag(authTag);
    const token = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");

    return validateToken(partnerId, token);
  } catch {
    throw new Error("미리보기 링크 복호화에 실패했습니다.");
  }
}
