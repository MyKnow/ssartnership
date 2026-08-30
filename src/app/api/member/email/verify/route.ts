import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
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
  completeMemberEmailVerification,
  getMemberEmailVerificationHttpFailure,
  isMemberEmailVerificationCodeFailure,
} from "@/lib/member-email-verification-service";
import { normalizeMemberEmail } from "@/lib/member-domain";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSignedUserSession } from "@/lib/user-auth";
import { MAX_STANDARD_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (
    !isTrustedSameOriginRequest(request, {
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json(
      { ok: false, message: "요청을 확인해 주세요." },
      { status: 403 },
    );
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 },
    );
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
        { ok: false, message: "요청 본문이 너무 큽니다." },
        { status: 413 },
      );
    }
  }
  const email = normalizeMemberEmail(body?.email);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { ok: false, message: "이메일과 6자리 인증 코드를 확인해 주세요." },
      { status: 400 },
    );
  }

  const rateLimitContext = {
    ipAddress: context.ipAddress ?? null,
    accountIdentifier: hashMemberEmailIdentifier(email),
  };
  const blockingState = await getMemberEmailVerificationBlockingState("verify", rateLimitContext);
  if (!blockingState.ok) {
    await logAuthSecurity({
      ...context,
      eventName: "member_email_verification",
      status: "failure",
      actorType: "member",
      actorId: session.userId,
      properties: { stage: "verify", reason: blockingState.code },
    });
    return NextResponse.json(
      {
        ok: false,
        message: "인증 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
  if (blockingState.blocked) {
    await logAuthSecurity({
      ...context,
      eventName: "member_email_verification",
      status: "blocked",
      actorType: "member",
      actorId: session.userId,
      properties: { stage: "verify", reason: "rate_limit" },
    });
    return NextResponse.json(
      { ok: false, message: "인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  const emailReservationHash = buildReservedMemberIdentifierHashes({
    emailNormalized: email,
  }).find((item) => item.identifierKind === "email")?.identifierHash;
  if (!emailReservationHash) {
    return NextResponse.json(
      { ok: false, message: "이메일 주소를 확인해 주세요." },
      { status: 400 },
    );
  }

  try {
    const completion = await completeMemberEmailVerification({
      memberId: session.userId,
      emailNormalized: email,
      emailReservationHash,
      codeHash: hashMemberEmailVerificationCode(email, code),
    });
    if (!completion.verified) {
      if (isMemberEmailVerificationCodeFailure(completion.reason)) {
        await recordMemberEmailVerificationAttempt(
          "verify",
          rateLimitContext,
          false,
        );
      }
      await logAuthSecurity({
        ...context,
        eventName: "member_email_verification",
        status: "failure",
        actorType: "member",
        actorId: session.userId,
        properties: { stage: "verify", reason: completion.reason },
      });
      const failure = getMemberEmailVerificationHttpFailure(completion.reason);
      return NextResponse.json(
        { ok: false, message: failure.message },
        { status: failure.status },
      );
    }
  } catch {
    await logAuthSecurity({
      ...context,
      eventName: "member_email_verification",
      status: "failure",
      actorType: "member",
      actorId: session.userId,
      properties: { stage: "verify", reason: "state_update_failed" },
    });
    return NextResponse.json(
      {
        ok: false,
        message: "이메일 인증을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }

  await recordMemberEmailVerificationAttempt("verify", rateLimitContext, true);
  await logAuthSecurity({
    ...context,
    eventName: "member_email_verification",
    status: "success",
    actorType: "member",
    actorId: session.userId,
    properties: { stage: "verify" },
  });
  revalidatePath("/certification");
  revalidatePath("/certification/email");
  return NextResponse.json({ ok: true });
}
