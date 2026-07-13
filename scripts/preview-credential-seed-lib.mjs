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

/**
 * Resolves the Preview test-account target through the canonical Mattermost
 * directory relation. `members.mm_username` is a retired mirror column.
 *
 * @param {{
 *   findDirectoryByUsername: (username: string) => Promise<{ id?: string | null } | null>,
 *   findActiveMemberByMattermostAccountId: (directoryId: string) => Promise<{ id?: string | null } | null>,
 * }} repository
 * @param {string} username
 */
export async function resolvePreviewMemberCredentialSeedTarget(repository, username) {
  const directory = await repository.findDirectoryByUsername(username);
  if (!directory?.id) {
    throw new Error(
      `Preview test member "${username}" has no active Mattermost directory entry after sync.`,
    );
  }

  const member = await repository.findActiveMemberByMattermostAccountId(directory.id);
  if (!member?.id) {
    throw new Error(
      `Preview test member "${username}" is not linked to an active member after sync.`,
    );
  }

  return member;
}
