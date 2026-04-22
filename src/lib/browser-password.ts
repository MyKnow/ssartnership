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

export function generateBrowserPassword(length = 12) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*_-+=?";
  const all = letters + numbers + symbols;

  const getRandomIndex = (max: number) => {
    if (
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.getRandomValues === "function"
    ) {
      const buffer = new Uint32Array(1);
      globalThis.crypto.getRandomValues(buffer);
      return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
  };

  const pick = (set: string) => set[getRandomIndex(set.length)];
  const chars = [pick(letters), pick(numbers), pick(symbols)];

  while (chars.length < length) {
    chars.push(pick(all));
  }

  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = getRandomIndex(index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }

  return chars.join("");
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
