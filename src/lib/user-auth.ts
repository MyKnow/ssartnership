import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import {
  evaluateRequiredPolicyStatus,
  getActiveRequiredPolicies,
} from "@/lib/policy-documents";
import { createHmacDigest, splitSignedToken, verifyHmacDigest } from "./hmac.js";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

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

export async function getSignedUserSession() {
  noStore();
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifyToken(token);
}

export async function setUserSession(
  userId: string,
  mustChangePassword = false,
  options?: {
    policyConsentSnapshot?: PolicyConsentSnapshot | null;
  },
) {
  const now = Date.now();
  const currentSession = (await getSignedUserSession()) as SignedUserSession | null;
  const resolvedPolicyConsentSnapshot =
    options?.policyConsentSnapshot !== undefined
      ? options.policyConsentSnapshot
      : currentSession?.userId === userId
        ? currentSession.policyConsentSnapshot ?? undefined
        : undefined;
  const payload = JSON.stringify({
    userId,
    mustChangePassword,
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
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
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
      "id,must_change_password,service_policy_version,privacy_policy_version",
    )
    .eq("id", session.userId)
    .maybeSingle();
  const activePoliciesPromise = getActiveRequiredPolicies();

  const [{ data: member }, activePolicies] = await Promise.all([
    memberPromise,
    activePoliciesPromise,
  ]);

  if (!member?.id) {
    return null;
  }

  const policyStatus = evaluateRequiredPolicyStatus(member, activePolicies);
  const consentSnapshotIsFresh =
    session.policyConsentSnapshot?.serviceVersion === activePolicies.service.version &&
    session.policyConsentSnapshot?.privacyVersion === activePolicies.privacy.version;

  return {
    ...session,
    mustChangePassword: Boolean(member.must_change_password),
    requiresConsent: consentSnapshotIsFresh ? false : policyStatus.requiresConsent,
  };
}
