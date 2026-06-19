import crypto from "node:crypto";

const PASSWORD_ITERATIONS = 120_000;
const PASSWORD_KEY_LENGTH = 64;

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function resolvePreviewMemberCredentialSeedConfig(env = process.env) {
  const username = env.PREVIEW_TEST_MEMBER_USERNAME?.trim() ?? "";
  const password = env.PREVIEW_TEST_MEMBER_PASSWORD ?? "";

  if (!username && !password) {
    return null;
  }

  if (!username || !password) {
    throw new Error(
      "PREVIEW_TEST_MEMBER_USERNAME and PREVIEW_TEST_MEMBER_PASSWORD must be provided together.",
    );
  }

  return {
    username: username.toLowerCase(),
    password,
  };
}

export function isValidPreviewSeedPassword(value) {
  if (value.length < 8 || value.length > 64) {
    return false;
  }

  return /[A-Za-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export function hashPreviewSeedPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(
      password,
      salt,
      PASSWORD_ITERATIONS,
      PASSWORD_KEY_LENGTH,
      "sha256",
    )
    .toString("hex");

  return { hash, salt };
}
