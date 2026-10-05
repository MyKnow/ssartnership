import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { signPayloadWith } from "@/lib/hmac.js";
import {
  buildSessionCookieOptions,
  MEMBER_EMAIL_RECOVERY_COOKIE_NAME,
} from "@/lib/session-cookies";
import { readSessionSecret } from "@/lib/session-secrets";
import {
  MEMBER_EMAIL_RECOVERY_SESSION_TTL_MS,
  parseMemberEmailRecoveryToken,
  type MemberEmailRecoveryTokenPayload as MemberEmailRecoverySessionPayload,
} from "@/lib/session-tokens";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const COOKIE_NAME = MEMBER_EMAIL_RECOVERY_COOKIE_NAME;
export { MEMBER_EMAIL_RECOVERY_SESSION_TTL_MS };

function getSecret() {
  return readSessionSecret("member-email-recovery", {
    errorMessage: "회원 복구 세션용 HMAC 비밀값이 필요합니다.",
  });
}

function signPayload(payload: string) {
  return signPayloadWith(payload, getSecret(), "hex");
}

function parseSession(token: string) {
  return parseMemberEmailRecoveryToken(token, getSecret());
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
  store.set(
    COOKIE_NAME,
    signPayload(payload),
    buildSessionCookieOptions(
      Math.floor(MEMBER_EMAIL_RECOVERY_SESSION_TTL_MS / 1_000),
    ),
  );
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
