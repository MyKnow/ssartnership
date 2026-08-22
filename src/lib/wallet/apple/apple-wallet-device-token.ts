import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { getAppleWalletMasterKeyStatus } from "./config";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const PUSH_TOKEN_ENCRYPTION_KEY_CONTEXT =
  "ssartnership:apple-wallet:push-token-encryption-key:v1";
const DEVICE_ID_HASH_KEY_CONTEXT =
  "ssartnership:apple-wallet:device-id-hash-key:v1";
const DEVICE_ID_HASH_CONTEXT = "ssartnership:apple-wallet:device-id:v1\0";

export type EncryptedApplePushToken = {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
};

function readEncryptionKey() {
  const status = getAppleWalletMasterKeyStatus();
  if (!status.ok) {
    throw new Error("Apple Wallet device token 암호화 키 형식이 올바르지 않습니다.");
  }
  return status.key;
}

function assertValidEncryptionKey(key: Buffer) {
  if (key.length !== 32) {
    throw new Error("Apple Wallet device token 암호화 키 형식이 올바르지 않습니다.");
  }
}

function derivePushTokenEncryptionKey(masterKey: Buffer) {
  assertValidEncryptionKey(masterKey);
  return createHmac("sha256", masterKey)
    .update(PUSH_TOKEN_ENCRYPTION_KEY_CONTEXT)
    .digest();
}

export function hashAppleDeviceLibraryIdentifier(
  deviceLibraryIdentifier: string,
  encryptionKey = readEncryptionKey(),
) {
  const normalized = deviceLibraryIdentifier.trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(normalized)) {
    return null;
  }
  assertValidEncryptionKey(encryptionKey);
  const hashKey = createHmac("sha256", encryptionKey)
    .update(DEVICE_ID_HASH_KEY_CONTEXT)
    .digest();
  return createHmac("sha256", hashKey)
    .update(DEVICE_ID_HASH_CONTEXT)
    .update(normalized)
    .digest("base64url");
}

export function normalizeApplePushToken(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._~-]{16,512}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export function encryptApplePushToken(
  pushToken: string,
  options: {
    key?: Buffer;
    keyVersion?: number;
    random?: (size: number) => Buffer;
  } = {},
): EncryptedApplePushToken {
  const normalized = normalizeApplePushToken(pushToken);
  if (!normalized) {
    throw new Error("Apple Wallet push token 형식이 올바르지 않습니다.");
  }
  const masterKey = options.key ?? readEncryptionKey();
  const key = derivePushTokenEncryptionKey(masterKey);
  const iv = (options.random ?? randomBytes)(IV_BYTES);
  if (iv.length !== IV_BYTES) {
    throw new Error("Apple Wallet device token IV 형식이 올바르지 않습니다.");
  }
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    keyVersion: options.keyVersion ?? 1,
  };
}

export function decryptApplePushToken(
  encrypted: EncryptedApplePushToken,
  masterKey = readEncryptionKey(),
) {
  const key = derivePushTokenEncryptionKey(masterKey);
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encrypted.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
