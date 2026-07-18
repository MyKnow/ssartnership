import type { MattermostSenderKey, MattermostSenderKeyring } from "./crypto";

const KEY_VERSION_ENV_NAME = "MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION";
const MAX_KEY_VERSION = 99;

function getActiveKeyVersion() {
  const value = process.env[KEY_VERSION_ENV_NAME]?.trim() ?? "";
  if (!/^\d+$/.test(value)) {
    throw new Error(`${KEY_VERSION_ENV_NAME} 환경 변수가 필요합니다.`);
  }

  const keyVersion = Number(value);
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1 || keyVersion > MAX_KEY_VERSION) {
    throw new Error(`${KEY_VERSION_ENV_NAME} 값이 올바르지 않습니다.`);
  }
  return keyVersion;
}

function getKeyEnvironmentName(keyVersion: number) {
  return `MM_SENDER_CREDENTIALS_KEY_V${keyVersion}`;
}

export function getActiveMattermostSenderKey(): MattermostSenderKey {
  const keyVersion = getActiveKeyVersion();
  const key = process.env[getKeyEnvironmentName(keyVersion)]?.trim();
  if (!key) {
    throw new Error(`${getKeyEnvironmentName(keyVersion)} 환경 변수가 필요합니다.`);
  }

  return { keyVersion, key };
}

/**
 * Rotation keeps every currently configured key available only to server-side
 * decryption. New candidates always use getActiveMattermostSenderKey().
 */
export function getMattermostSenderKeyring(): MattermostSenderKeyring {
  const activeKey = getActiveMattermostSenderKey();
  const keyring: MattermostSenderKeyring = {
    [activeKey.keyVersion]: activeKey.key,
  };

  for (let keyVersion = 1; keyVersion <= MAX_KEY_VERSION; keyVersion += 1) {
    const key = process.env[getKeyEnvironmentName(keyVersion)]?.trim();
    if (key) {
      keyring[keyVersion] = key;
    }
  }

  return keyring;
}

export function getMattermostBaseUrl() {
  const value = process.env.MM_BASE_URL?.trim();
  if (!value) {
    throw new Error("MM_BASE_URL 환경 변수가 필요합니다.");
  }

  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol)
      || url.username
      || url.password
      || url.search
      || url.hash
    ) {
      throw new Error("invalid base URL");
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error("MM_BASE_URL 형식을 확인해 주세요.");
  }
}
