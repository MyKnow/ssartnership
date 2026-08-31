export async function copyPasswordToClipboard(value: string) {
  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard ||
    typeof navigator.clipboard.writeText !== "function"
  ) {
    throw new Error("clipboard_unavailable");
  }
  await navigator.clipboard.writeText(value);
}

export async function storePasswordCredential(input: {
  loginId: string;
  password: string;
  displayName: string;
}) {
  const passwordCredentialCtor = (
    globalThis as typeof globalThis & {
      PasswordCredential?: new (init: {
        id: string;
        password: string;
        name?: string;
      }) => Credential;
    }
  ).PasswordCredential;

  if (
    typeof navigator === "undefined" ||
    !("credentials" in navigator) ||
    !passwordCredentialCtor
  ) {
    return;
  }

  try {
    const credential = new passwordCredentialCtor({
      id: input.loginId,
      password: input.password,
      name: input.displayName,
    });
    await navigator.credentials.store(credential);
  } catch {
    // Browsers may reject credential storage depending on policy or support.
  }
}

export const BROWSER_PASSWORD_GENERATION_UNAVAILABLE_MESSAGE =
  "이 브라우저에서는 안전한 비밀번호 자동 생성을 사용할 수 없습니다. 직접 입력해 주세요.";

export const BROWSER_PASSWORD_INVALID_LENGTH_MESSAGE =
  "비밀번호 자동 생성 길이는 8자 이상 64자 이하의 정수여야 합니다.";

export type BrowserPasswordGenerationErrorCode =
  | "invalid_length"
  | "secure_random_unavailable";

export type BrowserPasswordGenerationError = Readonly<{
  code: BrowserPasswordGenerationErrorCode;
  message: string;
}>;

export type BrowserPasswordGenerationResult =
  | Readonly<{ ok: true; password: string }>
  | Readonly<{ ok: false; error: BrowserPasswordGenerationError }>;

export class BrowserPasswordGenerationException extends Error {
  readonly code: BrowserPasswordGenerationErrorCode;

  constructor(error: BrowserPasswordGenerationError) {
    super(error.message);
    this.name = "BrowserPasswordGenerationException";
    this.code = error.code;
  }
}

const MIN_GENERATED_PASSWORD_LENGTH = 8;
const MAX_GENERATED_PASSWORD_LENGTH = 64;
const UINT32_RANGE = 0x1_0000_0000;
const MAX_REJECTION_ATTEMPTS = 128;

function generationFailure(
  code: BrowserPasswordGenerationErrorCode,
  message: string,
): BrowserPasswordGenerationResult {
  return { ok: false, error: { code, message } };
}

function getUnbiasedRandomIndex(crypto: Crypto, max: number) {
  const rejectionLimit = Math.floor(UINT32_RANGE / max) * max;
  const buffer = new Uint32Array(1);

  for (let attempt = 0; attempt < MAX_REJECTION_ATTEMPTS; attempt += 1) {
    crypto.getRandomValues(buffer);
    const value = buffer[0];
    if (value < rejectionLimit) {
      return value % max;
    }
  }

  throw new Error("secure_random_rejection_exhausted");
}

export function tryGenerateBrowserPassword(
  length = 12,
): BrowserPasswordGenerationResult {
  if (
    !Number.isInteger(length) ||
    length < MIN_GENERATED_PASSWORD_LENGTH ||
    length > MAX_GENERATED_PASSWORD_LENGTH
  ) {
    return generationFailure(
      "invalid_length",
      BROWSER_PASSWORD_INVALID_LENGTH_MESSAGE,
    );
  }

  const crypto = globalThis.crypto;
  if (!crypto || typeof crypto.getRandomValues !== "function") {
    return generationFailure(
      "secure_random_unavailable",
      BROWSER_PASSWORD_GENERATION_UNAVAILABLE_MESSAGE,
    );
  }

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*_-+=?";
  const all = letters + numbers + symbols;

  try {
    const pick = (set: string) => set[getUnbiasedRandomIndex(crypto, set.length)];
    const chars = [pick(letters), pick(numbers), pick(symbols)];

    while (chars.length < length) {
      chars.push(pick(all));
    }

    for (let index = chars.length - 1; index > 0; index -= 1) {
      const swapIndex = getUnbiasedRandomIndex(crypto, index + 1);
      [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
    }

    return { ok: true, password: chars.join("") };
  } catch {
    return generationFailure(
      "secure_random_unavailable",
      BROWSER_PASSWORD_GENERATION_UNAVAILABLE_MESSAGE,
    );
  }
}

export function generateBrowserPassword(length = 12) {
  const result = tryGenerateBrowserPassword(length);
  if (!result.ok) {
    throw new BrowserPasswordGenerationException(result.error);
  }
  return result.password;
}

export function isBrowserPasswordValid(value: string) {
  if (value.length < 8 || value.length > 64) {
    return false;
  }
  const hasLetter = /[A-Za-z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  return hasLetter && hasNumber && hasSymbol;
}
