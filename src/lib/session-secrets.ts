/**
 * Registry of the environment variables that sign or key each server-side
 * token family. Every Node module that used to carry its own `getSecret()`
 * reads through this registry so the length policy and the remaining legacy
 * fallbacks are visible in one place.
 *
 * Never import this module from a "use client" file; the client module
 * boundary test fails the build if one does.
 */

export const SESSION_SECRET_MIN_LENGTH = 32;

export type SessionSecretPurpose =
  | "user-session"
  | "admin-session"
  | "partner-session"
  | "member-email-recovery"
  | "mattermost-code-session"
  | "mattermost-code-verification"
  | "reset-password-completion"
  | "manual-member-import-token"
  | "certification-qr"
  | "member-identifier-reservation"
  | "member-email-verification";

/**
 * The first defined variable wins (`??` semantics). Keys after the first are
 * legacy fallbacks onto `USER_SESSION_SECRET`:
 * - `partner-session`: removal belongs to the partner session cleanup and must
 *   change `src/lib/partner-session.ts` and `src/proxy.ts` together.
 * - `reset-password-completion`, `manual-member-import-token`: the dedicated
 *   variables are optional in production, so removing the fallback would
 *   rotate the effective key and void links that were already issued.
 * Purposes whose dedicated variable is required by the self-hosted runtime
 * validation have no fallback. `tests/session-secrets.test.mts` pins this list.
 */
export const SESSION_SECRET_ENV_KEYS = {
  "user-session": ["USER_SESSION_SECRET"],
  "admin-session": ["ADMIN_SESSION_SECRET"],
  "partner-session": ["PARTNER_SESSION_SECRET", "USER_SESSION_SECRET"],
  "member-email-recovery": ["USER_SESSION_SECRET"],
  "mattermost-code-session": ["USER_SESSION_SECRET"],
  "mattermost-code-verification": ["USER_SESSION_SECRET"],
  "reset-password-completion": [
    "RESET_PASSWORD_SESSION_SECRET",
    "USER_SESSION_SECRET",
  ],
  "manual-member-import-token": [
    "MANUAL_MEMBER_IMPORT_TOKEN_SECRET",
    "USER_SESSION_SECRET",
  ],
  "certification-qr": ["CERTIFICATION_QR_SECRET"],
  "member-identifier-reservation": ["MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET"],
  "member-email-verification": ["MEMBER_EMAIL_VERIFICATION_HMAC_SECRET"],
} as const satisfies Record<SessionSecretPurpose, readonly [string, ...string[]]>;

type SecretEnvironment = Readonly<Record<string, string | undefined>>;

function resolveSecretValue(
  purpose: SessionSecretPurpose,
  environment: SecretEnvironment,
) {
  for (const key of SESSION_SECRET_ENV_KEYS[purpose]) {
    const value = environment[key];
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

/**
 * Returns the configured secret, or null when it is missing or shorter than
 * the shared minimum. Use this where a missing secret must fail closed
 * without throwing (the proxy and recoverable verification paths).
 */
export function findSessionSecret(
  purpose: SessionSecretPurpose,
  environment: SecretEnvironment = process.env,
) {
  const value = resolveSecretValue(purpose, environment);
  return value && value.length >= SESSION_SECRET_MIN_LENGTH ? value : null;
}

/**
 * Returns the configured secret or throws a configuration error. Messages
 * name only the primary variable, never a value.
 */
export function readSessionSecret(
  purpose: SessionSecretPurpose,
  options: {
    environment?: SecretEnvironment;
    errorMessage?: string;
  } = {},
) {
  const value = resolveSecretValue(purpose, options.environment ?? process.env);
  const primaryKey = SESSION_SECRET_ENV_KEYS[purpose][0];
  if (!value) {
    throw new Error(options.errorMessage ?? `${primaryKey} 환경 변수가 필요합니다.`);
  }
  if (value.length < SESSION_SECRET_MIN_LENGTH) {
    throw new Error(
      options.errorMessage
        ?? `${primaryKey}는 최소 ${SESSION_SECRET_MIN_LENGTH}자 이상이어야 합니다.`,
    );
  }
  return value;
}
