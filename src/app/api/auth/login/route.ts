import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { setUserSession } from "@/lib/user-auth";
import { verifyPassword } from "@/lib/password";
import { isValidEmail, normalizeMmUsername, validateMmUsername } from "@/lib/validation";
import { getMemberRequiredPolicyStatus } from "@/lib/policy-documents";
import { resolveSelectableMemberByUsername } from "@/lib/ssafy-verify/directory";
import { findMmUserDirectoryEntryByUsername, upsertMmUserDirectorySnapshot } from "@/lib/mm-directory";
import {
  delayMemberAuthAttempt,
  getMemberAuthAttemptScope,
  getMemberAuthBlockingState,
  recordMemberAuthAttempt,
} from "@/lib/member-auth-security";
import { hashGraduateEmailIdentifier } from "@/lib/graduate-verification-security";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

type LoginMember = {
  id: string;
  password_hash: string | null;
  password_salt: string | null;
  must_change_password: boolean | null;
};

const MEMBER_SELECT = "id,password_hash,password_salt,must_change_password";

async function resolveMattermostMember(identifier: string) {
  const supabase = getSupabaseAdminClient();
  const directoryEntry = await findMmUserDirectoryEntryByUsername(identifier);
  if (directoryEntry?.mm_user_id) {
    const { data } = await supabase
      .from("members")
      .select(MEMBER_SELECT)
      .eq("mm_user_id", directoryEntry.mm_user_id)
      .maybeSingle();
    return (data ?? null) as LoginMember | null;
  }
  const resolved = await resolveSelectableMemberByUsername(identifier);
  if (!resolved) return null;
  if (resolved.directorySnapshot) {
    await upsertMmUserDirectorySnapshot(resolved.directorySnapshot);
  }
  const { data } = await supabase
    .from("members")
    .select(MEMBER_SELECT)
    .eq("mm_user_id", resolved.user.id)
    .maybeSingle();
  return (data ?? null) as LoginMember | null;
}

async function resolveGraduateEmailMember(email: string) {
  const supabase = getSupabaseAdminClient();
  const { data: identity } = await supabase
    .from("member_auth_identities")
    .select("member_id")
    .eq("provider", "graduate_email")
    .eq("identifier_normalized", email)
    .maybeSingle();
  const memberId = (identity as { member_id?: string | null } | null)?.member_id;
  if (!memberId) return null;
  const { data } = await supabase
    .from("members")
    .select(MEMBER_SELECT)
    .eq("id", memberId)
    .maybeSingle();
  return (data ?? null) as LoginMember | null;
}

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ error: "login_failed" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as {
      identifier?: unknown;
      password?: unknown;
      autoLogin?: unknown;
    };
    const rawIdentifier = String(payload.identifier ?? "").trim();
    const password = String(payload.password ?? "").trim();
    const autoLogin = payload.autoLogin === true;
    const isGraduateEmail = rawIdentifier.includes("@");
    const identifier = isGraduateEmail
      ? rawIdentifier.toLowerCase()
      : normalizeMmUsername(rawIdentifier);
    const rateLimitIdentifier = isGraduateEmail
      ? hashGraduateEmailIdentifier(identifier)
      : identifier;
    const throttleContext = {
      ipAddress: context.ipAddress ?? null,
      accountIdentifier: rateLimitIdentifier || null,
    };
    const blockedState = await getMemberAuthBlockingState("login", throttleContext);
    if (blockedState) {
      await logAuthSecurity({
        ...context,
        eventName: "member_login",
        status: "blocked",
        actorType: "guest",
        identifier: isGraduateEmail ? null : identifier || null,
        properties: {
          reason: "rate_limit",
          scope: getMemberAuthAttemptScope(blockedState.identifier),
          provider: isGraduateEmail ? "graduate_email" : "mattermost",
        },
      });
      await delayMemberAuthAttempt("login", true);
      return NextResponse.json({ error: "blocked" }, { status: 429 });
    }
    if (!identifier || !password) {
      await recordMemberAuthAttempt("login", throttleContext, false);
      await delayMemberAuthAttempt("login");
      return NextResponse.json({ error: "login_failed" }, { status: 400 });
    }
    if (isGraduateEmail ? !isValidEmail(identifier) : Boolean(validateMmUsername(identifier))) {
      await recordMemberAuthAttempt("login", throttleContext, false);
      await delayMemberAuthAttempt("login");
      return NextResponse.json({ error: "login_failed" }, { status: 400 });
    }

    const member = isGraduateEmail
      ? await resolveGraduateEmailMember(identifier)
      : await resolveMattermostMember(identifier);
    if (!member?.password_hash || !member.password_salt) {
      await recordMemberAuthAttempt("login", throttleContext, false);
      await delayMemberAuthAttempt("login");
      return NextResponse.json({ error: "login_failed" }, { status: 401 });
    }
    if (!verifyPassword(password, member.password_salt, member.password_hash)) {
      await logAuthSecurity({
        ...context,
        eventName: "member_login",
        status: "failure",
        actorType: "member",
        actorId: member.id,
        identifier: isGraduateEmail ? null : identifier,
        properties: { reason: "invalid_credentials", provider: isGraduateEmail ? "graduate_email" : "mattermost" },
      });
      await recordMemberAuthAttempt("login", throttleContext, false);
      await delayMemberAuthAttempt("login");
      return NextResponse.json({ error: "login_failed" }, { status: 401 });
    }

    const policyStatus = await getMemberRequiredPolicyStatus(member.id);
    await setUserSession(member.id, Boolean(member.must_change_password), { persistent: autoLogin });
    revalidatePath("/");
    revalidatePath("/auth/consent");
    revalidatePath("/auth/change-password");
    revalidatePath("/certification");
    await recordMemberAuthAttempt("login", throttleContext, true);
    await logAuthSecurity({
      ...context,
      eventName: "member_login",
      status: "success",
      actorType: "member",
      actorId: member.id,
      identifier: isGraduateEmail ? null : identifier,
      properties: {
        mustChangePassword: Boolean(member.must_change_password),
        requiresConsent: policyStatus.requiresConsent,
        autoLogin,
        provider: isGraduateEmail ? "graduate_email" : "mattermost",
      },
    });
    return NextResponse.json({ ok: true, requiresConsent: policyStatus.requiresConsent });
  } catch {
    await logAuthSecurity({
      ...context,
      eventName: "member_login",
      status: "failure",
      actorType: "guest",
      properties: { reason: "exception" },
    });
    await delayMemberAuthAttempt("login", true);
    return NextResponse.json({ error: "login_failed" }, { status: 503 });
  }
}
