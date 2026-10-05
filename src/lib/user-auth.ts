import { cookies } from "next/headers";
import { cache } from "react";
import {
  evaluateRequiredPolicyVersionStatus,
  getActiveRequiredPolicyVersions,
  getMemberPolicyConsentVersions,
  isPolicyConsentSnapshotFresh,
} from "@/lib/policy-documents.server";
import { getMemberProfilePhotoState } from "@/lib/member-profile-images";
import { signPayloadWith } from "./hmac.js";
import {
  buildSessionCookieOptions,
  USER_SESSION_COOKIE_NAME,
} from "./session-cookies.ts";
import { readSessionSecret } from "./session-secrets.ts";
import {
  parseUserSessionToken,
  type PolicyConsentSnapshot,
  type UserSessionAuthenticationMethod,
  type UserSessionTokenPayload,
} from "./session-tokens.ts";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { requiresMemberProfilePhotoUpdate } from "@/lib/member-profile-photo";
import { requiresMemberEmailRegistration } from "@/lib/member-required-gates";
import {
  getMockMemberById,
  isMockMemberAuthEnabled,
} from "@/lib/mock/member";

const COOKIE_NAME = USER_SESSION_COOKIE_NAME;
const SESSION_TTL_DAYS = 7;
const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

type SignedUserSession = UserSessionTokenPayload & {
  requiresEmailRegistration?: boolean;
};

export type { UserSessionAuthenticationMethod };

export class UserSessionIssueError extends Error {
  readonly code:
    | "member_not_active"
    | "mattermost_login_disabled"
    | "stale_session"
    | "authentication_method_required";

  constructor(
    code:
      | "member_not_active"
      | "mattermost_login_disabled"
      | "stale_session"
      | "authentication_method_required",
  ) {
    super(code);
    this.name = "UserSessionIssueError";
    this.code = code;
  }
}

function getSecret() {
  return readSessionSecret("user-session");
}

function signPayload(payload: string) {
  return signPayloadWith(payload, getSecret(), "hex");
}

function verifyToken(token: string) {
  return parseUserSessionToken(token, getSecret());
}

/**
 * `freshAuthentication` is passed only by flows that just checked a
 * credential (password login, emailed setup link, recovery code, current
 * password change). Every other re-issue (for example a consent snapshot
 * refresh) carries the previous credential time forward so it cannot reset
 * the recent-auth window.
 */
function resolveSessionAuthenticatedAt(
  userId: string,
  currentSession: SignedUserSession | null,
  freshAuthentication: boolean | undefined,
  now: number,
) {
  if (freshAuthentication) {
    return now;
  }
  return currentSession?.userId === userId
    ? currentSession.authenticatedAt
    : undefined;
}

async function getRawSignedUserSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifyToken(token);
}

/**
 * Returns a cryptographically valid session only while the underlying member
 * remains active. This DB check is deliberate: cookie signatures alone cannot
 * revoke access after a soft delete.
 */
export const getSignedUserSession = cache(async () => {
  const session = (await getRawSignedUserSession()) as SignedUserSession | null;
  if (!session?.userId) {
    return null;
  }

  if (isMockMemberAuthEnabled()) {
    const member = getMockMemberById(session.userId);
    return member?.authSessionVersion === session.authSessionVersion
      ? {
          ...session,
          mustChangePassword: member.mustChangePassword,
          requiresEmailRegistration: false,
        }
      : null;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("members")
      .select(
        "id,auth_session_version,must_change_password,email_verified_at,mattermost_login_disabled_at",
      )
      .eq("id", session.userId)
      .is("deleted_at", null)
      .maybeSingle();
    return data?.id && data.auth_session_version === session.authSessionVersion
      ? {
          ...session,
          mustChangePassword: Boolean(data.must_change_password),
          requiresEmailRegistration: requiresMemberEmailRegistration({
            mattermostLoginDisabledAt: data.mattermost_login_disabled_at,
            emailVerifiedAt: data.email_verified_at,
          }),
        }
      : null;
  } catch {
    return null;
  }
});

export const getActiveUserSession = getSignedUserSession;

export async function setUserSession(
  userId: string,
  mustChangePassword = false,
  options?: {
    policyConsentSnapshot?: PolicyConsentSnapshot | null;
    persistent?: boolean;
    authenticationMethod?: UserSessionAuthenticationMethod;
    freshAuthentication?: boolean;
  },
) {
  if (isMockMemberAuthEnabled()) {
    const member = getMockMemberById(userId);
    if (!member) {
      throw new UserSessionIssueError("member_not_active");
    }

    const currentSession = (await getRawSignedUserSession()) as SignedUserSession | null;
    const authenticationMethod = options?.authenticationMethod
      ?? (currentSession?.userId === userId
        ? currentSession.authenticationMethod
        : null);
    if (!authenticationMethod) {
      throw new UserSessionIssueError("authentication_method_required");
    }

    const now = Date.now();
    const resolvedPolicyConsentSnapshot =
      options?.policyConsentSnapshot !== undefined
        ? options.policyConsentSnapshot
        : currentSession?.userId === userId
          ? currentSession.policyConsentSnapshot ?? undefined
          : undefined;
    const persistent = options?.persistent ?? currentSession?.persistent ?? true;
    const authenticatedAt = resolveSessionAuthenticatedAt(
      userId,
      currentSession,
      options?.freshAuthentication,
      now,
    );
    const payload = JSON.stringify({
      userId,
      authSessionVersion: member.authSessionVersion,
      authenticationMethod,
      mustChangePassword: member.mustChangePassword,
      persistent,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
      ...(resolvedPolicyConsentSnapshot !== undefined
        ? { policyConsentSnapshot: resolvedPolicyConsentSnapshot }
        : {}),
      ...(authenticatedAt !== undefined ? { authenticatedAt } : {}),
    });
    const token = signPayload(payload);
    const store = await cookies();
    store.set(
      COOKIE_NAME,
      token,
      buildSessionCookieOptions(persistent ? SESSION_TTL_SECONDS : undefined),
    );
    return;
  }

  const supabase = getSupabaseAdminClient();
  const currentSession = (await getRawSignedUserSession()) as SignedUserSession | null;
  const { data: member } = await supabase
    .from("members")
    .select("id,auth_session_version,mattermost_login_disabled_at")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!member?.id || !Number.isInteger(member.auth_session_version)) {
    throw new UserSessionIssueError("member_not_active");
  }
  const authenticationMethod = options?.authenticationMethod
    ?? (currentSession?.userId === userId
      ? currentSession.authenticationMethod
      : null);
  if (!authenticationMethod) {
    throw new UserSessionIssueError("authentication_method_required");
  }
  if (
    authenticationMethod === "mattermost"
    && member.mattermost_login_disabled_at
  ) {
    throw new UserSessionIssueError("mattermost_login_disabled");
  }
  if (
    currentSession?.userId === userId
    && currentSession.authSessionVersion !== member.auth_session_version
    && !options?.freshAuthentication
  ) {
    throw new UserSessionIssueError("stale_session");
  }

  const now = Date.now();
  const resolvedPolicyConsentSnapshot =
    options?.policyConsentSnapshot !== undefined
      ? options.policyConsentSnapshot
      : currentSession?.userId === userId
        ? currentSession.policyConsentSnapshot ?? undefined
        : undefined;
  const persistent = options?.persistent ?? currentSession?.persistent ?? true;
  const authenticatedAt = resolveSessionAuthenticatedAt(
    userId,
    currentSession,
    options?.freshAuthentication,
    now,
  );
  const payload = JSON.stringify({
    userId,
    authSessionVersion: member.auth_session_version,
    authenticationMethod,
    mustChangePassword,
    persistent,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
    ...(resolvedPolicyConsentSnapshot !== undefined
      ? { policyConsentSnapshot: resolvedPolicyConsentSnapshot }
      : {}),
    ...(authenticatedAt !== undefined ? { authenticatedAt } : {}),
  });
  const token = signPayload(payload);
  const store = await cookies();
  store.set(
    COOKIE_NAME,
    token,
    buildSessionCookieOptions(persistent ? SESSION_TTL_SECONDS : undefined),
  );
}

export async function clearUserSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Signs the member out on every device by advancing `auth_session_version`.
 * Every signed session carries the version it was issued with, so all of
 * them (and any admin session bridged from them) fail validation afterwards.
 * The compare-and-set keeps concurrent logouts idempotent. Mock members have
 * a fixed version, so mock mode only clears the local cookie.
 */
export async function revokeUserSessions(session: {
  userId: string;
  authSessionVersion: number;
}) {
  if (isMockMemberAuthEnabled()) {
    return true;
  }
  const { error } = await getSupabaseAdminClient()
    .from("members")
    .update({ auth_session_version: session.authSessionVersion + 1 })
    .eq("id", session.userId)
    .eq("auth_session_version", session.authSessionVersion);
  return !error;
}

export const getUserSession = cache(async () => {
  const session = (await getSignedUserSession()) as SignedUserSession | null;
  if (!session?.userId) {
    return null;
  }

  // The gate needs only the active versions, never the policy bodies. A fresh
  // consent snapshot in the signed session skips the consent-table read; a
  // session without a snapshot can never be fresh, so that read starts now.
  const policyConsentSnapshot = session.policyConsentSnapshot ?? null;
  const eagerConsentVersionsPromise = policyConsentSnapshot
    ? null
    : getMemberPolicyConsentVersions(session.userId);
  eagerConsentVersionsPromise?.catch(() => undefined);

  const [activePolicyVersions, photoState] = await Promise.all([
    getActiveRequiredPolicyVersions(),
    getMemberProfilePhotoState(session.userId),
  ]);

  const requiresConsent = isPolicyConsentSnapshotFresh(
    policyConsentSnapshot,
    activePolicyVersions,
  )
    ? false
    : evaluateRequiredPolicyVersionStatus(
        await (eagerConsentVersionsPromise ??
          getMemberPolicyConsentVersions(session.userId)),
        activePolicyVersions,
      ).requiresConsent;

  return {
    ...session,
    mustChangePassword: Boolean(session.mustChangePassword),
    requiresConsent,
    requiresEmailRegistration: Boolean(session.requiresEmailRegistration),
    requiresProfilePhotoUpdate: requiresMemberProfilePhotoUpdate(
      photoState.reviewStatus,
    ),
  };
});
