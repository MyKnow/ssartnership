import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { isE2eMockMutationEnabled } from "@/lib/e2e-mutation-mode";
import { sendMemberEmailVerificationCode } from "@/lib/member-email";
import {
  generateMemberEmailVerificationCode,
  hashMemberEmailIdentifier,
  hashMemberEmailVerificationCode,
  MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS,
} from "@/lib/member-email-verification";
import {
  getMemberEmailVerificationBlockingState,
  recordMemberEmailVerificationAttempt,
} from "@/lib/member-email-rate-limit";
import { hasReservedMemberIdentifier } from "@/lib/member-identifier-reservations";
import { normalizeMemberEmail } from "@/lib/member-domain";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getSignedUserSession } from "@/lib/user-auth";

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

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const email = normalizeMemberEmail(body?.email);
  if (!email) {
    return NextResponse.json(
      { ok: false, message: "이메일 주소를 확인해 주세요." },
      { status: 400 },
    );
  }

  const rateLimitContext = {
    ipAddress: context.ipAddress ?? null,
    accountIdentifier: hashMemberEmailIdentifier(email),
  };
  if (await getMemberEmailVerificationBlockingState("send", rateLimitContext)) {
    await logAuthSecurity({
      ...context,
      eventName: "member_email_verification",
      status: "blocked",
      actorType: "member",
      actorId: session.userId,
      properties: { stage: "send", reason: "rate_limit" },
    });
    return NextResponse.json(
      { ok: false, message: "인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data: currentMember, error: currentMemberError } = await supabase
    .from("members")
    .select("email_normalized,email_verified_at")
    .eq("id", session.userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (currentMemberError || !currentMember) {
    return NextResponse.json(
      { ok: false, message: "회원 정보를 확인하지 못했습니다." },
      { status: 401 },
    );
  }
  if (
    currentMember.email_normalized === email &&
    currentMember.email_verified_at
  ) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }
  if (await hasReservedMemberIdentifier({ emailNormalized: email })) {
    return NextResponse.json(
      { ok: false, message: "사용할 수 없는 이메일입니다." },
      { status: 409 },
    );
  }

  const { data: otherMember, error: otherMemberError } = await supabase
    .from("members")
    .select("id")
    .eq("email_normalized", email)
    .is("deleted_at", null)
    .neq("id", session.userId)
    .maybeSingle();
  if (otherMemberError) {
    return NextResponse.json(
      { ok: false, message: "이메일 상태를 확인하지 못했습니다." },
      { status: 503 },
    );
  }
  if (otherMember?.id) {
    return NextResponse.json(
      { ok: false, message: "이미 다른 계정에서 사용 중인 이메일입니다." },
      { status: 409 },
    );
  }

  const code = generateMemberEmailVerificationCode();
  const expiresAt = new Date(
    Date.now() + MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS * 1_000,
  ).toISOString();
  const { data: challenge, error: challengeError } = await supabase
    .from("member_email_challenges")
    .insert({
      member_id: session.userId,
      email_normalized: email,
      purpose: "email_verify",
      code_hash: hashMemberEmailVerificationCode(email, code),
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (challengeError || !challenge?.id) {
    return NextResponse.json(
      {
        ok: false,
        message: "인증 요청을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }

  // A successful send intentionally counts toward the resend cap.
  await recordMemberEmailVerificationAttempt("send", rateLimitContext, false);
  try {
    if (!isE2eMockMutationEnabled()) {
      await sendMemberEmailVerificationCode({ to: email, code });
    }
    await logAuthSecurity({
      ...context,
      eventName: "member_email_verification",
      status: "success",
      actorType: "member",
      actorId: session.userId,
      properties: { stage: "send" },
    });
    return NextResponse.json({
      ok: true,
      expiresInSeconds: MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS,
      ...(isE2eMockMutationEnabled() ? { testCode: code } : {}),
    });
  } catch {
    await supabase
      .from("member_email_challenges")
      .delete()
      .eq("id", challenge.id);
    await logAuthSecurity({
      ...context,
      eventName: "member_email_verification",
      status: "failure",
      actorType: "member",
      actorId: session.userId,
      properties: { stage: "send", reason: "delivery_failed" },
    });
    return NextResponse.json(
      {
        ok: false,
        message: "인증 코드를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
}
