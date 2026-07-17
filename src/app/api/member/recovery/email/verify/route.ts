import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { clearMemberEmailRecoverySession, getMemberEmailRecoverySession } from "@/lib/member-email-recovery-session";
import {
  hashMemberEmailIdentifier,
  hashMemberEmailVerificationCode,
} from "@/lib/member-email-verification";
import {
  getMemberEmailVerificationBlockingState,
  recordMemberEmailVerificationAttempt,
} from "@/lib/member-email-rate-limit";
import { buildReservedMemberIdentifierHashes } from "@/lib/member-identifier-reservations";
import { normalizeMemberEmail } from "@/lib/member-domain";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { setUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

type RecoveryCompletion = {
  verified?: unknown;
  reason?: unknown;
  mustChangePassword?: unknown;
};

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }
  let recovery;
  try {
    recovery = await getMemberEmailRecoverySession();
  } catch {
    return NextResponse.json({ ok: false, message: "복구 세션을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
  if (!recovery) {
    return NextResponse.json({ ok: false, error: "recovery_expired", message: "복구 세션이 만료되었습니다. 기존 비밀번호를 다시 확인해 주세요." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    code?: unknown;
  } | null;
  const email = normalizeMemberEmail(body?.email);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, message: "이메일과 6자리 인증 코드를 확인해 주세요." }, { status: 400 });
  }
  const rateLimitContext = {
    ipAddress: context.ipAddress ?? null,
    accountIdentifier: hashMemberEmailIdentifier(email),
  };
  if (await getMemberEmailVerificationBlockingState("recovery-verify", rateLimitContext)) {
    return NextResponse.json({ ok: false, error: "rate_limited", message: "인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  const emailReservationHash = buildReservedMemberIdentifierHashes({ emailNormalized: email })
    .find((item) => item.identifierKind === "email")?.identifierHash;
  if (!emailReservationHash) {
    return NextResponse.json({ ok: false, message: "이메일 주소를 확인해 주세요." }, { status: 400 });
  }

  try {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "complete_member_email_recovery",
      {
        p_member_id: recovery.memberId,
        p_email_normalized: email,
        p_email_reservation_hash: emailReservationHash,
        p_code_hash: hashMemberEmailVerificationCode(email, code),
      },
    );
    const completion = data && typeof data === "object" && !Array.isArray(data)
      ? data as RecoveryCompletion
      : null;
    if (error || completion?.verified !== true) {
      const reason = typeof completion?.reason === "string" ? completion.reason : "invalid_code";
      await recordMemberEmailVerificationAttempt("recovery-verify", rateLimitContext, false);
      await logAuthSecurity({
        ...context,
        eventName: "member_email_recovery",
        status: "failure",
        actorType: "member",
        actorId: recovery.memberId,
        properties: { stage: "email_verify", reason },
      });
      const isEmailConflict = reason === "email_conflict" || reason === "email_reserved";
      return NextResponse.json(
        {
          ok: false,
          message: isEmailConflict
            ? "사용할 수 없는 이메일입니다. 다른 이메일로 다시 인증해 주세요."
            : "인증 코드가 올바르지 않거나 만료되었습니다.",
        },
        { status: isEmailConflict ? 409 : 400 },
      );
    }

    await setUserSession(recovery.memberId, completion.mustChangePassword === true, {
      authenticationMethod: "email",
      freshAuthentication: true,
    });
    await clearMemberEmailRecoverySession();
    await recordMemberEmailVerificationAttempt("recovery-verify", rateLimitContext, true);
    await logAuthSecurity({
      ...context,
      eventName: "member_email_recovery",
      status: "success",
      actorType: "member",
      actorId: recovery.memberId,
      properties: { stage: "email_verify" },
    });
    return NextResponse.json({ ok: true, redirectTo: "/" });
  } catch {
    await recordMemberEmailVerificationAttempt("recovery-verify", rateLimitContext, false);
    return NextResponse.json({ ok: false, message: "이메일 로그인 전환을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}
