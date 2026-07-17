import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  delayMemberAuthAttempt,
  getMemberAuthAttemptScope,
  getMemberAuthBlockingState,
  recordMemberAuthAttempt,
} from "@/lib/member-auth-security";
import {
  consumeMattermostVerificationCode,
  type MattermostVerificationPurpose,
} from "@/lib/mattermost-code-verification";
import { setMattermostCodeSession } from "@/lib/mattermost-code-session";
import {
  getResetPasswordCompletionCookieOptions,
  issueResetPasswordCompletionToken,
  RESET_PASSWORD_COMPLETION_COOKIE_NAME,
} from "@/lib/reset-password-session";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function parsePurpose(value: unknown): MattermostVerificationPurpose | null {
  return value === "signup" || value === "reset_password" ? value : null;
}

async function createResetCompletionResponse(input: {
  mmUserId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data: directory, error: directoryError } = await supabase
    .from("mm_user_directory")
    .select("id,mm_user_id,mm_username")
    .eq("mm_user_id", input.mmUserId)
    .eq("is_active", true)
    .maybeSingle();
  if (directoryError || !directory?.id || !directory.mm_username) {
    return null;
  }
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id,updated_at")
    .eq("mattermost_account_id", directory.id)
    .is("mattermost_login_disabled_at", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (memberError || !member?.id || !member.updated_at) {
    return null;
  }
  const token = issueResetPasswordCompletionToken({
    memberId: member.id,
    mmUserId: directory.mm_user_id,
    mmUsername: directory.mm_username,
    memberUpdatedAt: member.updated_at,
  });
  const response = NextResponse.json({ ok: true, nextPath: "/auth/reset/complete" });
  response.cookies.set(
    RESET_PASSWORD_COMPLETION_COOKIE_NAME,
    token,
    getResetPasswordCompletionCookieOptions(),
  );
  return response;
}

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const value = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const purpose = parsePurpose(value.purpose);
  if (!purpose) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const throttleContext = {
    ipAddress: context.ipAddress ?? null,
    accountIdentifier: null,
  };
  const blocked = await getMemberAuthBlockingState("mattermost-code-verify", throttleContext);
  if (blocked) {
    await logAuthSecurity({
      ...context,
      eventName: "member_mattermost_code",
      status: "blocked",
      actorType: "guest",
      properties: {
        purpose,
        phase: "verify",
        reason: "rate_limit",
        scope: getMemberAuthAttemptScope(blocked.identifier),
      },
    });
    await delayMemberAuthAttempt("mattermost-code-verify", true);
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  try {
    const verified = await consumeMattermostVerificationCode({
      purpose,
      challenge: value.challenge,
      code: value.code,
    });
    if (!verified) {
      await recordMemberAuthAttempt("mattermost-code-verify", throttleContext, false);
      await delayMemberAuthAttempt("mattermost-code-verify");
      await logAuthSecurity({
        ...context,
        eventName: "member_mattermost_code",
        status: "failure",
        actorType: "guest",
        properties: { purpose, phase: "verify", reason: "invalid_code" },
      });
      return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 400 });
    }

    if (purpose === "signup") {
      await setMattermostCodeSession({
        purpose,
        mmUserId: verified.mmUserId,
        subjectGeneration: verified.subjectGeneration,
        senderGeneration: verified.senderGeneration,
      });
      await recordMemberAuthAttempt("mattermost-code-verify", throttleContext, true);
      await logAuthSecurity({
        ...context,
        eventName: "member_mattermost_code",
        status: "success",
        actorType: "guest",
        properties: { purpose, phase: "verify", generation: verified.senderGeneration },
      });
      return NextResponse.json({ ok: true, nextPath: "/auth/signup/complete" });
    }

    const response = await createResetCompletionResponse({ mmUserId: verified.mmUserId });
    if (!response) {
      await recordMemberAuthAttempt("mattermost-code-verify", throttleContext, false);
      await delayMemberAuthAttempt("mattermost-code-verify");
      return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 400 });
    }
    await recordMemberAuthAttempt("mattermost-code-verify", throttleContext, true);
    await logAuthSecurity({
      ...context,
      eventName: "member_mattermost_code",
      status: "success",
      actorType: "guest",
      properties: { purpose, phase: "verify", generation: verified.senderGeneration },
    });
    return response;
  } catch {
    await recordMemberAuthAttempt("mattermost-code-verify", throttleContext, false);
    await delayMemberAuthAttempt("mattermost-code-verify");
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
