import { openSignedPayload } from "./hmac.js";

/**
 * Pure parsers for the signed `user_session`, `admin_session`, and
 * `partner_session` cookies. `src/proxy.ts` and the server session modules
 * must call these same functions so that the edge redirect decision and the
 * server authorization decision can never disagree about a token's shape,
 * signature, or lifetime.
 *
 * The wire format (`<json>.<hex hmac>`) and every field name are frozen:
 * changing them would sign out every member, admin, and partner at once.
 */

export type UserSessionAuthenticationMethod =
  | "email"
  | "manual"
  | "mattermost";

export type PolicyConsentSnapshot = {
  serviceVersion: number;
  privacyVersion: number;
};

export type UserSessionTokenPayload = {
  userId: string;
  authSessionVersion: number;
  authenticationMethod: UserSessionAuthenticationMethod;
  issuedAt: number;
  expiresAt: number;
  mustChangePassword?: boolean;
  persistent?: boolean;
  policyConsentSnapshot?: PolicyConsentSnapshot | null;
  /**
   * Time of the last credential check (password, emailed setup link, or
   * recovery code). Optional and additive: tokens issued before the field
   * existed still parse and are simply treated as "not recently
   * authenticated" by the recent-auth rule.
   */
  authenticatedAt?: number;
};

export type AdminSessionTokenPayload = {
  issuedAt: number;
  expiresAt: number;
  adminId: string;
  loginId: string;
  permissionVersion: number;
};

export type PartnerSessionTokenPayload = {
  accountId: string;
  loginId: string;
  displayName: string;
  companyIds: string[];
  authSessionVersion: number;
  mustChangePassword: boolean;
  issuedAt: number;
  expiresAt: number;
};

export function isUserSessionAuthenticationMethod(
  value: unknown,
): value is UserSessionAuthenticationMethod {
  return value === "email"
    || value === "manual"
    || value === "mattermost";
}

function parseSignedJsonObject(
  token: string,
  secret: string | null | undefined,
): Record<string, unknown> | null {
  if (!secret) {
    return null;
  }
  const payload = openSignedPayload(token, secret, "hex");
  if (!payload) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isWithinLifetime(issuedAt: number, expiresAt: number, now: number) {
  return issuedAt <= now && expiresAt > now;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function parsePolicyConsentSnapshot(
  value: unknown,
): PolicyConsentSnapshot | null | undefined | false {
  if (value === undefined || value === null) {
    return value;
  }
  if (
    typeof value !== "object"
    || typeof (value as PolicyConsentSnapshot).serviceVersion !== "number"
    || typeof (value as PolicyConsentSnapshot).privacyVersion !== "number"
  ) {
    return false;
  }
  return {
    serviceVersion: (value as PolicyConsentSnapshot).serviceVersion,
    privacyVersion: (value as PolicyConsentSnapshot).privacyVersion,
  };
}

export function parseUserSessionToken(
  token: string,
  secret: string | null | undefined,
  now = Date.now(),
): UserSessionTokenPayload | null {
  const parsed = parseSignedJsonObject(token, secret);
  if (!parsed) {
    return null;
  }
  if (
    typeof parsed.userId !== "string"
    || !isPositiveInteger(parsed.authSessionVersion)
    || !isUserSessionAuthenticationMethod(parsed.authenticationMethod)
    || typeof parsed.issuedAt !== "number"
    || typeof parsed.expiresAt !== "number"
  ) {
    return null;
  }
  if (!isWithinLifetime(parsed.issuedAt, parsed.expiresAt, now)) {
    return null;
  }
  if (parsed.persistent !== undefined && typeof parsed.persistent !== "boolean") {
    return null;
  }
  const policyConsentSnapshot = parsePolicyConsentSnapshot(
    parsed.policyConsentSnapshot,
  );
  if (policyConsentSnapshot === false) {
    return null;
  }
  if (
    parsed.authenticatedAt !== undefined
    && (
      typeof parsed.authenticatedAt !== "number"
      || !Number.isSafeInteger(parsed.authenticatedAt)
      || parsed.authenticatedAt <= 0
      || parsed.authenticatedAt > parsed.issuedAt
    )
  ) {
    return null;
  }

  return {
    userId: parsed.userId,
    authSessionVersion: parsed.authSessionVersion,
    authenticationMethod: parsed.authenticationMethod,
    issuedAt: parsed.issuedAt,
    expiresAt: parsed.expiresAt,
    ...(parsed.mustChangePassword !== undefined
      ? { mustChangePassword: parsed.mustChangePassword === true }
      : {}),
    ...(parsed.persistent !== undefined ? { persistent: parsed.persistent } : {}),
    ...(policyConsentSnapshot !== undefined ? { policyConsentSnapshot } : {}),
    ...(parsed.authenticatedAt !== undefined
      ? { authenticatedAt: parsed.authenticatedAt as number }
      : {}),
  };
}

export function parseAdminSessionToken(
  token: string,
  secret: string | null | undefined,
  now = Date.now(),
): AdminSessionTokenPayload | null {
  const parsed = parseSignedJsonObject(token, secret);
  if (!parsed) {
    return null;
  }
  if (
    typeof parsed.issuedAt !== "number"
    || typeof parsed.expiresAt !== "number"
    || typeof parsed.adminId !== "string"
    || parsed.adminId.length === 0
    || typeof parsed.loginId !== "string"
    || parsed.loginId.length === 0
    || typeof parsed.permissionVersion !== "number"
  ) {
    return null;
  }
  if (!isWithinLifetime(parsed.issuedAt, parsed.expiresAt, now)) {
    return null;
  }
  return {
    issuedAt: parsed.issuedAt,
    expiresAt: parsed.expiresAt,
    adminId: parsed.adminId,
    loginId: parsed.loginId,
    permissionVersion: parsed.permissionVersion,
  };
}

/**
 * Used by both `src/lib/partner-session.ts` and `src/proxy.ts`. Tokens issued
 * before `authSessionVersion` existed default to version 1, matching the
 * account column default.
 */
export function parsePartnerSessionToken(
  token: string,
  secret: string | null | undefined,
  now = Date.now(),
): PartnerSessionTokenPayload | null {
  const parsed = parseSignedJsonObject(token, secret);
  if (!parsed) {
    return null;
  }
  if (
    typeof parsed.accountId !== "string"
    || typeof parsed.loginId !== "string"
    || typeof parsed.displayName !== "string"
    || !Array.isArray(parsed.companyIds)
    || (parsed.authSessionVersion !== undefined
      && !isPositiveInteger(parsed.authSessionVersion))
    || (parsed.mustChangePassword !== undefined
      && typeof parsed.mustChangePassword !== "boolean")
    || typeof parsed.issuedAt !== "number"
    || typeof parsed.expiresAt !== "number"
  ) {
    return null;
  }
  if (!isWithinLifetime(parsed.issuedAt, parsed.expiresAt, now)) {
    return null;
  }
  const companyIds = parsed.companyIds as unknown[];
  if (
    companyIds.length === 0
    || companyIds.some((companyId) => typeof companyId !== "string" || !companyId)
  ) {
    return null;
  }
  return {
    accountId: parsed.accountId,
    loginId: parsed.loginId,
    displayName: parsed.displayName,
    companyIds: companyIds as string[],
    authSessionVersion: (parsed.authSessionVersion as number | undefined) ?? 1,
    mustChangePassword: parsed.mustChangePassword === true,
    issuedAt: parsed.issuedAt,
    expiresAt: parsed.expiresAt,
  };
}

export const MEMBER_EMAIL_RECOVERY_SESSION_TTL_MS = 15 * 60 * 1000;

export type MemberEmailRecoveryTokenPayload = {
  memberId: string;
  authSessionVersion: number;
  issuedAt: number;
  expiresAt: number;
};

/**
 * `member_email_recovery` shares `USER_SESSION_SECRET` with `user_session`,
 * so the distinct required fields (`memberId` vs `userId`) and the 15-minute
 * lifetime cap are what keep the two token purposes from being swapped.
 */
export function parseMemberEmailRecoveryToken(
  token: string,
  secret: string | null | undefined,
  now = Date.now(),
): MemberEmailRecoveryTokenPayload | null {
  const value = parseSignedJsonObject(token, secret);
  if (!value) {
    return null;
  }
  if (
    typeof value.memberId !== "string"
    || !value.memberId
    || !isPositiveInteger(value.authSessionVersion)
    || !Number.isSafeInteger(value.issuedAt)
    || !Number.isSafeInteger(value.expiresAt)
  ) {
    return null;
  }
  const issuedAt = value.issuedAt as number;
  const expiresAt = value.expiresAt as number;
  if (
    !isWithinLifetime(issuedAt, expiresAt, now)
    || expiresAt - issuedAt > MEMBER_EMAIL_RECOVERY_SESSION_TTL_MS
  ) {
    return null;
  }
  return {
    memberId: value.memberId,
    authSessionVersion: value.authSessionVersion,
    issuedAt,
    expiresAt,
  };
}
