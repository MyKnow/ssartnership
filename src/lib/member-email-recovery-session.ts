import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createHmacDigest, splitSignedToken, verifyHmacDigest } from "@/lib/hmac.js";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const COOKIE_NAME = "member_email_recovery";
export const MEMBER_EMAIL_RECOVERY_SESSION_TTL_MS = 15 * 60 * 1000;

type MemberEmailRecoverySessionPayload = {
  memberId: string;
  authSessionVersion: number;
  issuedAt: number;
  expiresAt: number;
};

function getSecret() {
  const secret = process.env.USER_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("회원 복구 세션용 HMAC 비밀값이 필요합니다.");
  }
  return secret;
}

function signPayload(payload: string) {
  return `${payload}.${createHmacDigest(payload, getSecret(), "hex")}`;
}

function parseSession(token: string) {
  const signed = splitSignedToken(token);
  if (!signed) return null;
  const [payload, signature] = signed;
  if (!payload || !signature || !verifyHmacDigest(payload, signature, getSecret(), "hex")) {
    return null;
  }
  try {
    const value = JSON.parse(payload) as MemberEmailRecoverySessionPayload;
    if (
      typeof value.memberId !== "string"
      || !value.memberId
      || !Number.isInteger(value.authSessionVersion)
      || value.authSessionVersion < 1
      || !Number.isSafeInteger(value.issuedAt)
      || !Number.isSafeInteger(value.expiresAt)
      || value.issuedAt > Date.now()
      || value.expiresAt <= Date.now()
      || value.expiresAt - value.issuedAt > MEMBER_EMAIL_RECOVERY_SESSION_TTL_MS
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export async function setMemberEmailRecoverySession(input: {
  memberId: string;
  authSessionVersion: number;
}) {
  const now = Date.now();
  const payload = JSON.stringify({
    memberId: input.memberId,
    authSessionVersion: input.authSessionVersion,
    issuedAt: now,
    expiresAt: now + MEMBER_EMAIL_RECOVERY_SESSION_TTL_MS,
  } satisfies MemberEmailRecoverySessionPayload);
  const store = await cookies();
  store.set(COOKIE_NAME, signPayload(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(MEMBER_EMAIL_RECOVERY_SESSION_TTL_MS / 1_000),
    path: "/",
  });
}

export async function getMemberEmailRecoverySession() {
  noStore();
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const session = token ? parseSession(token) : null;
  if (!session) return null;

  const { data } = await getSupabaseAdminClient()
    .from("members")
    .select("id,auth_session_version,must_change_password")
    .eq("id", session.memberId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data?.id || data.auth_session_version !== session.authSessionVersion) {
    return null;
  }
  return {
    memberId: session.memberId,
    mustChangePassword: Boolean(data.must_change_password),
  };
}

export async function clearMemberEmailRecoverySession() {
  (await cookies()).delete(COOKIE_NAME);
}
