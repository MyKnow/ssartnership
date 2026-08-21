import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  createGraduateEmailSendBlockedResponse,
  runGraduateEmailDelivery,
} from "@/lib/graduate-email-delivery";
import { sendGraduateVerificationCodeEmail } from "@/lib/graduate-verification-email";
import { GRADUATE_EMAIL_CODE_TTL_SECONDS } from "@/lib/graduate-verification-email-code";
import {
  normalizeGraduateEmail,
  parseGraduateVerificationRequestKind,
} from "@/lib/graduate-verification";
import { isE2eMockMutationEnabled } from "@/lib/e2e-mutation-mode";
import {
  generateGraduateEmailCode,
  hashGraduateEmailCode,
  hashGraduateEmailIdentifier,
} from "@/lib/graduate-verification-security";
import {
  clearGraduateEmailProviderFailures,
  getGraduateEmailSendBlockingState,
  recordGraduateEmailProviderFailure,
  recordGraduateEmailSendSuccess,
} from "@/lib/graduate-verification-rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { isValidEmail } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    requestKind?: unknown;
  } | null;
  const email = normalizeGraduateEmail(String(body?.email ?? ""));
  const requestKind = body?.requestKind === undefined
    ? "graduate_signup"
    : parseGraduateVerificationRequestKind(body.requestKind);
  if (!requestKind) {
    return NextResponse.json({ ok: false, message: "인증 유형을 확인해 주세요." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, message: "이메일 주소를 확인해 주세요." }, { status: 400 });
  }

  const accountIdentifier = hashGraduateEmailIdentifier(email);
  const rateLimitContext = {
    ipAddress: context.ipAddress,
    accountIdentifier,
  };
  const blockingState = await getGraduateEmailSendBlockingState(rateLimitContext);
  if (blockingState) {
    await logAuthSecurity({
      ...context,
      eventName: "graduate_email_verification",
      status: "blocked",
      actorType: "guest",
      properties: { reason: blockingState.reason, stage: "send" },
    }).catch(() => undefined);
    return createGraduateEmailSendBlockedResponse(blockingState);
  }

  const code = generateGraduateEmailCode();
  const supabase = getSupabaseAdminClient();
  const { data: challenge, error } = await supabase
    .from("graduate_email_challenges")
    .insert({
      email_normalized: email,
      purpose: "application",
      request_kind: requestKind,
      code_hash: hashGraduateEmailCode(email, code),
      expires_at: new Date(Date.now() + GRADUATE_EMAIL_CODE_TTL_SECONDS * 1_000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !challenge?.id) {
    return NextResponse.json({ ok: false, message: "인증 요청을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }

  const mockMutationEnabled = isE2eMockMutationEnabled();
  const delivery = await runGraduateEmailDelivery({
    requestId: context.requestId,
    deliver: async () => {
      if (!mockMutationEnabled) {
        await sendGraduateVerificationCodeEmail({
          to: email,
          code,
          expiresInSeconds: GRADUATE_EMAIL_CODE_TTL_SECONDS,
        });
      }
    },
    afterSuccess: [
      () => recordGraduateEmailSendSuccess(rateLimitContext),
      () => clearGraduateEmailProviderFailures(rateLimitContext),
      () =>
        logAuthSecurity({
          ...context,
          eventName: "graduate_email_verification",
          status: "success",
          actorType: "guest",
          properties: { stage: "send" },
        }),
    ],
    afterFailure: (diagnostic) => [
      async () => {
        await supabase
          .from("graduate_email_challenges")
          .delete()
          .eq("id", challenge.id);
      },
      () => recordGraduateEmailProviderFailure(rateLimitContext),
      () =>
        logAuthSecurity({
          ...context,
          eventName: "graduate_email_verification",
          status: "failure",
          actorType: "guest",
          properties: {
            reason: "delivery_failed",
            stage: "send",
            errorCode: diagnostic.errorCode,
          },
        }),
      () => {
        console.error("[graduate-email] delivery_failed", diagnostic);
      },
    ],
  });

  if (!delivery.ok) {
    return NextResponse.json({ ok: false, message: "인증 코드를 보내지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    expiresInSeconds: GRADUATE_EMAIL_CODE_TTL_SECONDS,
    ...(mockMutationEnabled ? { testCode: code } : {}),
  });
}
