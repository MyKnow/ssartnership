import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type MattermostSenderCredentials = {
  loginId: string;
  password: string;
};

export type EncryptedMattermostSenderCredentials = {
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: number;
};

export type MattermostSenderKey = {
  keyVersion: number;
  key: string;
};

export type MattermostSenderKeyring = Record<number, string>;

const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

function getKeyError(keyVersion: number) {
  return new Error(
    `MM_SENDER_CREDENTIALS_KEY_V${keyVersion}는 32바이트 base64 키여야 합니다.`,
  );
}

function decodeKey(key: string, keyVersion: number) {
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1 || typeof key !== "string") {
    throw getKeyError(keyVersion);
  }

  const normalized = key.trim().replace(/-/g, "+").replace(/_/g, "/");
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw getKeyError(keyVersion);
  }

  const decoded = Buffer.from(normalized, "base64");
  if (decoded.length !== KEY_BYTES) {
    throw getKeyError(keyVersion);
  }

  return decoded;
}

function serializeCredentials(credentials: MattermostSenderCredentials) {
  if (
    !credentials
    || typeof credentials.loginId !== "string"
    || typeof credentials.password !== "string"
  ) {
    throw new Error("Mattermost Sender credential 형식이 올바르지 않습니다.");
  }

  return JSON.stringify({
    loginId: credentials.loginId,
    password: credentials.password,
  });
}

function parseCredentials(payload: string): MattermostSenderCredentials {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (
      !parsed
      || typeof parsed !== "object"
      || Array.isArray(parsed)
      || typeof (parsed as { loginId?: unknown }).loginId !== "string"
      || typeof (parsed as { password?: unknown }).password !== "string"
    ) {
      throw new Error("invalid credential payload");
    }

    return {
      loginId: (parsed as { loginId: string }).loginId,
      password: (parsed as { password: string }).password,
    };
  } catch {
    throw new Error("Mattermost Sender credential 복호화에 실패했습니다.");
  }
}

export function encryptMattermostSenderCredentials(
  credentials: MattermostSenderCredentials,
  encryptionKey: MattermostSenderKey,
): EncryptedMattermostSenderCredentials {
  const key = decodeKey(encryptionKey.key, encryptionKey.keyVersion);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([
    cipher.update(serializeCredentials(credentials), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    nonce: nonce.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion: encryptionKey.keyVersion,
  };
}

export function decryptMattermostSenderCredentials(
  encryptedCredentials: EncryptedMattermostSenderCredentials,
  keyring: MattermostSenderKeyring,
): MattermostSenderCredentials {
  const key = keyring[encryptedCredentials.keyVersion];
  const decodedKey = decodeKey(key ?? "", encryptedCredentials.keyVersion);

  try {
    const nonce = Buffer.from(encryptedCredentials.nonce, "base64");
    const authTag = Buffer.from(encryptedCredentials.authTag, "base64");
    const ciphertext = Buffer.from(encryptedCredentials.ciphertext, "base64");
    if (
      nonce.length !== NONCE_BYTES
      || authTag.length !== AUTH_TAG_BYTES
      || ciphertext.length === 0
    ) {
      throw new Error("invalid ciphertext");
    }

    const decipher = createDecipheriv("aes-256-gcm", decodedKey, nonce);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");

    return parseCredentials(plaintext);
  } catch {
    throw new Error("Mattermost Sender credential 복호화에 실패했습니다.");
  }
}
