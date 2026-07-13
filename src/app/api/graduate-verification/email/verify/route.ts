import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { normalizeGraduateEmail } from "@/lib/graduate-verification";
import {
  hashGraduateEmailCode,
  hashGraduateEmailIdentifier,
  setGraduateApplicationSession,
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
  const body = (await request.json().catch(() => null)) as { email?: unknown; code?: unknown } | null;
  const email = normalizeGraduateEmail(String(body?.email ?? ""));
  const code = String(body?.code ?? "").trim();
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, message: "이메일과 6자리 인증 코드를 확인해 주세요." }, { status: 400 });
  }

  const accountIdentifier = hashGraduateEmailIdentifier(email);
  const rateLimitContext = { route: "graduate-email-verify" as const, ipAddress: context.ipAddress, accountIdentifier };
  if (await isGraduateVerificationBlocked(rateLimitContext)) {
    return NextResponse.json({ ok: false, message: "인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: challenge } = await supabase
    .from("graduate_email_challenges")
    .select("id,code_hash,attempt_count,expires_at,verified_at")
    .eq("email_normalized", email)
    .eq("purpose", "application")
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const codeMatches = Boolean(
    challenge &&
      !challenge.verified_at &&
      new Date(challenge.expires_at).getTime() > Date.now() &&
      challenge.attempt_count < 10 &&
      challenge.code_hash === hashGraduateEmailCode(email, code),
  );
  if (!codeMatches || !challenge?.id) {
    if (challenge?.id) {
      await supabase
        .from("graduate_email_challenges")
        .update({ attempt_count: Math.min(10, Number(challenge.attempt_count ?? 0) + 1) })
        .eq("id", challenge.id);
    }
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    await logAuthSecurity({
      ...context,
      eventName: "graduate_email_verification",
      status: "failure",
      actorType: "guest",
      properties: { reason: "invalid_code", stage: "verify" },
    });
    return NextResponse.json({ ok: false, message: "인증 코드가 올바르지 않거나 만료되었습니다." }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("graduate_email_challenges")
    .update({ verified_at: new Date().toISOString(), attempt_count: Number(challenge.attempt_count ?? 0) + 1 })
    .eq("id", challenge.id)
    .is("verified_at", null);
  if (updateError) {
    return NextResponse.json({ ok: false, message: "이메일 인증을 완료하지 못했습니다." }, { status: 503 });
  }
  await setGraduateApplicationSession(challenge.id);
  await recordGraduateVerificationAttempt({ ...rateLimitContext, success: true });
  await logAuthSecurity({
    ...context,
    eventName: "graduate_email_verification",
    status: "success",
    actorType: "guest",
    properties: { stage: "verify" },
  });
  return NextResponse.json({ ok: true });
}
