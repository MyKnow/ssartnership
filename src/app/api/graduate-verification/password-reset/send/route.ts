import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { sendGraduateVerificationCodeEmail } from "@/lib/graduate-verification-email";
import { normalizeGraduateEmail } from "@/lib/graduate-verification";
import {
  generateGraduateEmailCode,
  hashGraduateEmailCode,
  hashGraduateEmailIdentifier,
} from "@/lib/graduate-verification-security";
import {
  isGraduateVerificationBlocked,
  recordGraduateVerificationAttempt,
} from "@/lib/graduate-verification-rate-limit";
import { findGraduateVerifiedMemberByEmail } from "@/lib/graduate-verification-service";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { isValidEmail } from "@/lib/validation";

export const runtime = "nodejs";

const GENERIC_RESPONSE = {
  ok: true,
  message: "해당 이메일 계정이 있으면 인증 코드를 보냈습니다.",
};

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

  const rateLimitContext = {
    route: "graduate-password-reset-send" as const,
    ipAddress: context.ipAddress,
    accountIdentifier: hashGraduateEmailIdentifier(email),
  };
  if (await isGraduateVerificationBlocked(rateLimitContext)) {
    await logAuthSecurity({
      ...context,
      eventName: "graduate_password_reset",
      status: "blocked",
      actorType: "guest",
      properties: { stage: "send", reason: "rate_limit" },
    });
    return NextResponse.json(
      { ok: false, message: "인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  const member = await findGraduateVerifiedMemberByEmail(email);
  if (!member) {
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: true });
    await logAuthSecurity({
      ...context,
      eventName: "graduate_password_reset",
      status: "success",
      actorType: "guest",
      properties: { stage: "send" },
    });
    return NextResponse.json(GENERIC_RESPONSE);
  }

  const code = generateGraduateEmailCode();
  const supabase = getSupabaseAdminClient();
  const { data: challenge, error } = await supabase
    .from("graduate_email_challenges")
    .insert({
      email_normalized: email,
      purpose: "password_reset",
      code_hash: hashGraduateEmailCode(email, code),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !challenge?.id) {
    return NextResponse.json(
      { ok: false, message: "인증 요청을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 503 },
    );
  }

  try {
    await sendGraduateVerificationCodeEmail({
      to: email,
      code,
      purpose: "password_reset",
    });
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: true });
    await logAuthSecurity({
      ...context,
      eventName: "graduate_password_reset",
      status: "success",
      actorType: "guest",
      properties: { stage: "send" },
    });
    return NextResponse.json(GENERIC_RESPONSE);
  } catch {
    await supabase.from("graduate_email_challenges").delete().eq("id", challenge.id);
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    await logAuthSecurity({
      ...context,
      eventName: "graduate_password_reset",
      status: "failure",
      actorType: "guest",
      properties: { stage: "send", reason: "delivery_failed" },
    });
    return NextResponse.json(
      { ok: false, message: "인증 코드를 보내지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 503 },
    );
  }
}
