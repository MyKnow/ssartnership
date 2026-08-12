import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAppleWalletMasterKeyStatus } from "@/lib/wallet/apple/config";

const PUBLIC_ID_BYTES = 32;
const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const QR_SIGNING_KEY_CONTEXT =
  "ssartnership:apple-wallet:qr-signing-key:v1";
const QR_SIGNATURE_CONTEXT = "ssartnership:apple-wallet:qr-token:v1\0";
const PASS_AUTH_KEY_CONTEXT =
  "ssartnership:apple-wallet:pass-auth-key:v1";
const PASS_AUTH_CONTEXT = "ssartnership:apple-wallet:pass-auth:v1\0";

export type WalletPassVerification = {
  publicId: string;
};

function getWalletMasterKey() {
  const status = getAppleWalletMasterKeyStatus();
  if (!status.ok) {
    throw new Error("Apple Wallet master key 설정이 올바르지 않습니다.");
  }
  return status.key;
}

function assertValidMasterKey(masterKey: Buffer) {
  if (masterKey.length !== 32) {
    throw new Error("Apple Wallet master key 형식이 올바르지 않습니다.");
  }
}

function deriveSubkey(masterKey: Buffer, context: string) {
  assertValidMasterKey(masterKey);
  return createHmac("sha256", masterKey).update(context).digest();
}

function digest(value: string, masterKey: Buffer, keyContext: string) {
  return createHmac("sha256", deriveSubkey(masterKey, keyContext))
    .update(value)
    .digest("base64url");
}

export function createWalletPassPublicId(
  random: (size: number) => Buffer = randomBytes,
) {
  return random(PUBLIC_ID_BYTES).toString("base64url");
}

export function createWalletPassSerialNumber(publicId: string) {
  if (!PUBLIC_ID_PATTERN.test(publicId)) {
    throw new Error("wallet pass public id가 올바르지 않습니다.");
  }
  return `sp-${publicId}`;
}

export function signWalletPassVerificationToken(
  publicId: string,
  masterKey = getWalletMasterKey(),
) {
  if (!PUBLIC_ID_PATTERN.test(publicId)) {
    throw new Error("wallet pass public id가 올바르지 않습니다.");
  }
  const signature = digest(
    `${QR_SIGNATURE_CONTEXT}${publicId}`,
    masterKey,
    QR_SIGNING_KEY_CONTEXT,
  );
  return `${publicId}.${signature}`;
}

export function verifyWalletPassVerificationToken(
  token: string,
  masterKey = getWalletMasterKey(),
): WalletPassVerification | null {
  const [publicId, signature, ...rest] = token.split(".");
  if (
    rest.length > 0 ||
    !PUBLIC_ID_PATTERN.test(publicId ?? "") ||
    !SIGNATURE_PATTERN.test(signature ?? "")
  ) {
    return null;
  }

  const actualBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(
    digest(
      `${QR_SIGNATURE_CONTEXT}${publicId}`,
      masterKey,
      QR_SIGNING_KEY_CONTEXT,
    ),
    "base64url",
  );
  const verified =
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer);
  return verified ? { publicId } : null;
}

export function createWalletPassVerificationUrl(
  publicId: string,
  options: { masterKey?: Buffer; siteUrl: string },
) {
  const token = signWalletPassVerificationToken(publicId, options.masterKey);
  return new URL(
    `/wallet/verify/${encodeURIComponent(token)}`,
    options.siteUrl,
  ).toString();
}

export function deriveAppleWalletAuthenticationToken(
  publicId: string,
  passTypeIdentifier: string,
  masterKey = getWalletMasterKey(),
) {
  if (!PUBLIC_ID_PATTERN.test(publicId)) {
    throw new Error("wallet pass public id가 올바르지 않습니다.");
  }
  const normalizedPassTypeIdentifier = passTypeIdentifier.trim();
  if (!normalizedPassTypeIdentifier) {
    throw new Error("Apple Wallet Pass Type ID가 필요합니다.");
  }
  return digest(
    `${PASS_AUTH_CONTEXT}${normalizedPassTypeIdentifier}\0${publicId}`,
    masterKey,
    PASS_AUTH_KEY_CONTEXT,
  );
}
