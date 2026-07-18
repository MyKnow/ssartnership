import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import {
  evaluateRequiredPolicyStatus,
  getActiveRequiredPolicies,
  getMemberPolicyConsentVersions,
} from "@/lib/policy-documents";
import { getMemberProfilePhotoState } from "@/lib/member-profile-images";
import { createHmacDigest, splitSignedToken, verifyHmacDigest } from "./hmac.js";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { requiresMemberProfilePhotoUpdate } from "@/lib/member-profile-photo";

const COOKIE_NAME = "user_session";
const SESSION_TTL_DAYS = 7;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

type PolicyConsentSnapshot = {
  serviceVersion: number;
  privacyVersion: number;
};

type SignedUserSession = {
  userId: string;
  authSessionVersion: number;
  authenticationMethod: UserSessionAuthenticationMethod;
  issuedAt: number;
  expiresAt: number;
  mustChangePassword?: boolean;
  persistent?: boolean;
  policyConsentSnapshot?: PolicyConsentSnapshot | null;
};

export type UserSessionAuthenticationMethod =
  | "email"
  | "manual"
  | "mattermost";

function isUserSessionAuthenticationMethod(
  value: unknown,
): value is UserSessionAuthenticationMethod {
  return value === "email"
    || value === "manual"
    || value === "mattermost";
}

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
  const secret = process.env.USER_SESSION_SECRET;
  if (!secret) {
    throw new Error("USER_SESSION_SECRET 환경 변수가 필요합니다.");
  }
  if (secret.length < 32) {
    throw new Error("USER_SESSION_SECRET는 최소 32자 이상이어야 합니다.");
  }
  return secret;
}

function signPayload(payload: string) {
  const secret = getSecret();
  const signature = createHmacDigest(payload, secret, "hex");
  return `${payload}.${signature}`;
}

function verifyToken(token: string) {
  const signedToken = splitSignedToken(token);
  if (!signedToken) {
    return null;
  }
  const [payload, signature] = signedToken;
  if (!payload || !signature) {
    return null;
  }
  if (!verifyHmacDigest(payload, signature, getSecret(), "hex")) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as SignedUserSession;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.authSessionVersion !== "number" ||
      !Number.isInteger(parsed.authSessionVersion) ||
      parsed.authSessionVersion < 1 ||
      !isUserSessionAuthenticationMethod(parsed.authenticationMethod) ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAt <= Date.now() || parsed.issuedAt > Date.now()) {
      return null;
    }
    if (
      parsed.persistent !== undefined &&
      typeof parsed.persistent !== "boolean"
    ) {
      return null;
    }
    if (
      parsed.policyConsentSnapshot !== undefined &&
      parsed.policyConsentSnapshot !== null &&
      (typeof parsed.policyConsentSnapshot !== "object" ||
        typeof parsed.policyConsentSnapshot.serviceVersion !== "number" ||
        typeof parsed.policyConsentSnapshot.privacyVersion !== "number")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function getRawSignedUserSession() {
  noStore();
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
export async function getSignedUserSession() {
  const session = (await getRawSignedUserSession()) as SignedUserSession | null;
  if (!session?.userId) {
    return null;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("members")
      .select("id,auth_session_version")
      .eq("id", session.userId)
      .is("deleted_at", null)
      .maybeSingle();
    return data?.id && data.auth_session_version === session.authSessionVersion
      ? session
      : null;
  } catch {
    return null;
  }
}

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
  });
  const token = signPayload(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(persistent ? { maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 } : {}),
    path: "/",
  });
}

export async function clearUserSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getUserSession() {
  noStore();
  const session = (await getSignedUserSession()) as SignedUserSession | null;
  if (!session?.userId) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const memberPromise = supabase
    .from("members")
    .select("id,must_change_password")
    .eq("id", session.userId)
    .is("deleted_at", null)
    .maybeSingle();
  const activePoliciesPromise = getActiveRequiredPolicies();
  const consentVersionsPromise = getMemberPolicyConsentVersions(session.userId);
  const photoStatePromise = getMemberProfilePhotoState(session.userId);

  const [{ data: member }, activePolicies, consentVersions, photoState] = await Promise.all([
    memberPromise,
    activePoliciesPromise,
    consentVersionsPromise,
    photoStatePromise,
  ]);

  if (!member?.id) {
    return null;
  }

  const policyStatus = evaluateRequiredPolicyStatus(
    consentVersions,
    activePolicies,
  );
  const consentSnapshotIsFresh =
    session.policyConsentSnapshot?.serviceVersion === activePolicies.service.version &&
    session.policyConsentSnapshot?.privacyVersion === activePolicies.privacy.version;

  return {
    ...session,
    mustChangePassword: Boolean(member.must_change_password),
    requiresConsent: consentSnapshotIsFresh ? false : policyStatus.requiresConsent,
    requiresProfilePhotoUpdate: requiresMemberProfilePhotoUpdate(
      photoState.reviewStatus,
    ),
  };
}
