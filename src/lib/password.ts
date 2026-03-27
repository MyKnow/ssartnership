import crypto from "crypto";

const ITERATIONS = 120_000;
const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha256")
    .toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string) {
  const compare = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha256")
    .toString("hex");
  if (compare.length !== hash.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(compare), Buffer.from(hash));
}

export function isValidPassword(value: string) {
  if (value.length < 8 || value.length > 64) {
    return false;
  }
  const hasLetter = /[A-Za-z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  return hasLetter && hasNumber && hasSymbol;
}

export function generateTempPassword(length = 12) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*_-+=?";
  const all = letters + numbers + symbols;
  const pick = (set: string) => set[crypto.randomInt(0, set.length)];
  const chars = [pick(letters), pick(numbers), pick(symbols)];
  while (chars.length < length) {
    chars.push(pick(all));
  }
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }
  return chars.join("");
}
