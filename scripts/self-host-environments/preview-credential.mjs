import crypto from "node:crypto";

/**
 * Preview-only member credential helpers for `cli.mjs seed-preview-member`.
 * The hash format matches the application's PBKDF2 member password storage.
 *
 * Moved from the retired cloud `sync:preview` tooling (RF-04, #537).
 */
const PASSWORD_ITERATIONS = 120_000;
const PASSWORD_KEY_LENGTH = 64;

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
