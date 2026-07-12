import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { sendGraduateVerificationCodeEmail } from "@/lib/graduate-verification-email";
import { GRADUATE_EMAIL_CODE_TTL_SECONDS } from "@/lib/graduate-verification-email-code";
import { normalizeGraduateEmail } from "@/lib/graduate-verification";
import { isE2eMockMutationEnabled } from "@/lib/e2e-mutation-mode";
import {
  generateGraduateEmailCode,
  hashGraduateEmailCode,
  hashGraduateEmailIdentifier,
} from "@/lib/graduate-verification-security";
import {
  isGraduateVerificationBlocked,
  recordGraduateVerificationAttempt,
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

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = normalizeGraduateEmail(String(body?.email ?? ""));
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, message: "이메일 주소를 확인해 주세요." }, { status: 400 });
  }

  const accountIdentifier = hashGraduateEmailIdentifier(email);
  const rateLimitContext = { route: "graduate-email-send" as const, ipAddress: context.ipAddress, accountIdentifier };
  if (await isGraduateVerificationBlocked(rateLimitContext)) {
    await logAuthSecurity({
      ...context,
      eventName: "graduate_email_verification",
      status: "blocked",
      actorType: "guest",
      properties: { reason: "rate_limit", stage: "send" },
    });
    return NextResponse.json({ ok: false, message: "인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const code = generateGraduateEmailCode();
  const supabase = getSupabaseAdminClient();
  const { data: challenge, error } = await supabase
    .from("graduate_email_challenges")
    .insert({
      email_normalized: email,
      purpose: "application",
      code_hash: hashGraduateEmailCode(email, code),
      expires_at: new Date(Date.now() + GRADUATE_EMAIL_CODE_TTL_SECONDS * 1_000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !challenge?.id) {
    return NextResponse.json({ ok: false, message: "인증 요청을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }

  try {
    if (!isE2eMockMutationEnabled()) {
      await sendGraduateVerificationCodeEmail({
        to: email,
        code,
        expiresInSeconds: GRADUATE_EMAIL_CODE_TTL_SECONDS,
      });
    }
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: true });
    await logAuthSecurity({
      ...context,
      eventName: "graduate_email_verification",
      status: "success",
      actorType: "guest",
      properties: { stage: "send" },
    });
    return NextResponse.json({
      ok: true,
      expiresInSeconds: GRADUATE_EMAIL_CODE_TTL_SECONDS,
      ...(isE2eMockMutationEnabled() ? { testCode: code } : {}),
    });
  } catch {
    await supabase.from("graduate_email_challenges").delete().eq("id", challenge.id);
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    await logAuthSecurity({
      ...context,
      eventName: "graduate_email_verification",
      status: "failure",
      actorType: "guest",
      properties: { reason: "delivery_failed", stage: "send" },
    });
    return NextResponse.json({ ok: false, message: "인증 코드를 보내지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}
