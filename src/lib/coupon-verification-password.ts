const PBKDF2_ITERATIONS = 120_000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

export type CouponVerificationPasswordHash = {
  hash: string;
  salt: string;
};

export function normalizeCouponVerificationPassword(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error("현장 확인 비밀번호는 숫자만 입력해 주세요.");
  }
  return value;
}

function getWebCrypto() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error("보안 암호화 기능을 사용할 수 없습니다.");
  }
  return cryptoApi;
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveHash(password: string, salt: Uint8Array) {
  const cryptoApi = getWebCrypto();
  const key = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await cryptoApi.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    HASH_LENGTH * 8,
  );
  return new Uint8Array(bits);
}

export async function hashCouponVerificationPassword(password: string) {
  const normalized = normalizeCouponVerificationPassword(password);
  if (!normalized) {
    throw new Error("현장 확인 비밀번호를 입력해 주세요.");
  }
  const salt = new Uint8Array(SALT_LENGTH);
  getWebCrypto().getRandomValues(salt);
  const hash = await deriveHash(normalized, salt);
  return {
    hash: encodeBase64(hash),
    salt: encodeBase64(salt),
  } satisfies CouponVerificationPasswordHash;
}

export async function verifyCouponVerificationPassword(
  password: string,
  stored: CouponVerificationPasswordHash,
) {
  const normalized = normalizeCouponVerificationPassword(password);
  if (!normalized) {
    return false;
  }
  try {
    const expected = decodeBase64(stored.hash);
    const salt = decodeBase64(stored.salt);
    if (expected.length !== HASH_LENGTH || salt.length !== SALT_LENGTH) {
      return false;
    }
    const actual = await deriveHash(normalized, salt);
    let difference = actual.length ^ expected.length;
    for (let index = 0; index < actual.length; index += 1) {
      difference |= actual[index] ^ expected[index];
    }
    return difference === 0;
  } catch {
    return false;
  }
}
