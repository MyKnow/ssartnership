import { cookies } from "next/headers";
import crypto from "crypto";
import {
  evaluateRequiredPolicyStatus,
  getActiveRequiredPolicies,
} from "@/lib/policy-documents";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const COOKIE_NAME = "user_session";
const SESSION_TTL_DAYS = 7;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

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
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

function verifyToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
  const ok = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
  if (!ok) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as {
      userId: string;
      issuedAt: number;
      expiresAt: number;
      mustChangePassword?: boolean;
    };
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
    return parsed;
  } catch {
    return null;
  }
}

export async function getSignedUserSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifyToken(token);
}

export async function setUserSession(userId: string, mustChangePassword = false) {
  const now = Date.now();
  const payload = JSON.stringify({
    userId,
    mustChangePassword,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
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
  const session = await getSignedUserSession();
  if (!session?.userId) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data: member } = await supabase
    .from("members")
    .select(
      "id,must_change_password,service_policy_version,privacy_policy_version",
    )
    .eq("id", session.userId)
    .maybeSingle();

  if (!member?.id) {
    return null;
  }

  const activePolicies = await getActiveRequiredPolicies();
  const policyStatus = evaluateRequiredPolicyStatus(member, activePolicies);

  return {
    ...session,
    mustChangePassword: Boolean(member.must_change_password),
    requiresConsent: policyStatus.requiresConsent,
  };
}
