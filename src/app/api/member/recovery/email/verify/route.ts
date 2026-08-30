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
import {
  completeMemberEmailRecovery,
  getMemberEmailRecoveryHttpFailure,
  isMemberEmailVerificationCodeFailure,
} from "@/lib/member-email-verification-service";
import { normalizeMemberEmail } from "@/lib/member-domain";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { setUserSession } from "@/lib/user-auth";
import { MAX_STANDARD_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";

export const runtime = "nodejs";

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

  let body: {
    email?: unknown;
    code?: unknown;
  } | null = null;
  try {
    body = await readRouteJsonBodyWithinLimit<{
      email?: unknown;
      code?: unknown;
    }>(request, {
      maximumBytes: MAX_STANDARD_JSON_BODY_BYTES,
      invalidMessage: "이메일과 6자리 인증 코드를 확인해 주세요.",
      tooLargeMessage: "요청 본문이 너무 큽니다.",
    });
  } catch (error) {
    if (error instanceof RouteJsonBodyError && error.code === "body_too_large") {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }
  }
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
    const completion = await completeMemberEmailRecovery({
      memberId: recovery.memberId,
      emailNormalized: email,
      emailReservationHash,
      codeHash: hashMemberEmailVerificationCode(email, code),
    });
    if (!completion.verified) {
      if (isMemberEmailVerificationCodeFailure(completion.reason)) {
        await recordMemberEmailVerificationAttempt(
          "recovery-verify",
          rateLimitContext,
          false,
        );
      }
      await logAuthSecurity({
        ...context,
        eventName: "member_email_recovery",
        status: "failure",
        actorType: "member",
        actorId: recovery.memberId,
        properties: { stage: "email_verify", reason: completion.reason },
      });
      const failure = getMemberEmailRecoveryHttpFailure(completion.reason);
      return NextResponse.json(
        { ok: false, message: failure.message },
        { status: failure.status },
      );
    }

    await setUserSession(recovery.memberId, completion.mustChangePassword, {
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
    return NextResponse.json(
      {
        ok: false,
        message: "이메일 복구를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
}
