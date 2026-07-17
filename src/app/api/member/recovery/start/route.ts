import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  delayMemberAuthAttempt,
  getMemberAuthBlockingState,
  recordMemberAuthAttempt,
} from "@/lib/member-auth-security";
import { hashMemberIdentifierForAudit } from "@/lib/member-identifier-reservations";
import { resolveMemberForEmailRecovery } from "@/lib/member-authentication";
import { setMemberEmailRecoverySession } from "@/lib/member-email-recovery-session";
import { verifyPassword } from "@/lib/password";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

const GENERIC_ERROR = "아이디 또는 비밀번호를 확인해 주세요.";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    identifier?: unknown;
    password?: unknown;
  } | null;
  const identifier = String(body?.identifier ?? "").trim();
  const password = String(body?.password ?? "");
  const throttle = {
    ipAddress: context.ipAddress ?? null,
    accountIdentifier: identifier ? hashMemberIdentifierForAudit(identifier) : null,
  };
  if (await getMemberAuthBlockingState("member-email-recovery", throttle)) {
    await delayMemberAuthAttempt("member-email-recovery", true);
    return NextResponse.json({ ok: false, error: "rate_limited", message: "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  try {
    const member = identifier && password
      ? await resolveMemberForEmailRecovery(identifier)
      : null;
    const passwordMatches = Boolean(
      member?.password_hash
      && member.password_salt
      && verifyPassword(password, member.password_salt, member.password_hash),
    );
    if (!member || !passwordMatches || !Number.isInteger(member.auth_session_version)) {
      await recordMemberAuthAttempt("member-email-recovery", throttle, false);
      await delayMemberAuthAttempt("member-email-recovery");
      await logAuthSecurity({
        ...context,
        eventName: "member_email_recovery",
        status: "failure",
        actorType: "guest",
        properties: { stage: "start", reason: "invalid_credentials" },
      });
      return NextResponse.json({ ok: false, error: "recovery_failed", message: GENERIC_ERROR }, { status: 401 });
    }

    await setMemberEmailRecoverySession({
      memberId: member.id,
      authSessionVersion: member.auth_session_version,
    });
    await recordMemberAuthAttempt("member-email-recovery", throttle, true);
    await logAuthSecurity({
      ...context,
      eventName: "member_email_recovery",
      status: "success",
      actorType: "member",
      actorId: member.id,
      properties: { stage: "start" },
    });
    return NextResponse.json({ ok: true, expiresInSeconds: 15 * 60 });
  } catch {
    await recordMemberAuthAttempt("member-email-recovery", throttle, false);
    await delayMemberAuthAttempt("member-email-recovery");
    return NextResponse.json({ ok: false, error: "unavailable", message: "복구 세션을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}
