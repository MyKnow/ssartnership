import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import {
  evaluateRequiredPolicyStatus,
  getActiveRequiredPolicies,
  getMemberPolicyConsentVersions,
} from "@/lib/policy-documents";
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
  issuedAt: number;
  expiresAt: number;
  mustChangePassword?: boolean;
  persistent?: boolean;
  policyConsentSnapshot?: PolicyConsentSnapshot | null;
};

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
      .select("id")
      .eq("id", session.userId)
      .is("deleted_at", null)
      .maybeSingle();
    return data?.id ? session : null;
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
  },
) {
  const now = Date.now();
  const currentSession = (await getRawSignedUserSession()) as SignedUserSession | null;
  const resolvedPolicyConsentSnapshot =
    options?.policyConsentSnapshot !== undefined
      ? options.policyConsentSnapshot
      : currentSession?.userId === userId
        ? currentSession.policyConsentSnapshot ?? undefined
        : undefined;
  const persistent = options?.persistent ?? currentSession?.persistent ?? true;
  const payload = JSON.stringify({
    userId,
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
    .select(
      "id,must_change_password,profile_photo_review_status",
    )
    .eq("id", session.userId)
    .is("deleted_at", null)
    .maybeSingle();
  const activePoliciesPromise = getActiveRequiredPolicies();
  const consentVersionsPromise = getMemberPolicyConsentVersions(session.userId);

  const [{ data: member }, activePolicies, consentVersions] = await Promise.all([
    memberPromise,
    activePoliciesPromise,
    consentVersionsPromise,
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
      member.profile_photo_review_status,
    ),
  };
}
