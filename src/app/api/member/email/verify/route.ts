import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  hashMemberEmailIdentifier,
  verifyMemberEmailVerificationCodeHash,
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
    code?: unknown;
  } | null;
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
  if (await getMemberEmailVerificationBlockingState("verify", rateLimitContext)) {
    return NextResponse.json(
      { ok: false, message: "인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data: challenge } = await supabase
    .from("member_email_challenges")
    .select("id,code_hash,attempt_count,expires_at,verified_at")
    .eq("member_id", session.userId)
    .eq("email_normalized", email)
    .eq("purpose", "email_verify")
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const codeMatches = Boolean(
    challenge &&
      !challenge.verified_at &&
      new Date(challenge.expires_at).getTime() > Date.now() &&
      Number(challenge.attempt_count ?? 0) < 10 &&
      verifyMemberEmailVerificationCodeHash(email, code, challenge.code_hash),
  );
  if (!codeMatches || !challenge?.id) {
    if (challenge?.id) {
      await supabase
        .from("member_email_challenges")
        .update({
          attempt_count: Math.min(10, Number(challenge.attempt_count ?? 0) + 1),
        })
        .eq("id", challenge.id);
    }
    await recordMemberEmailVerificationAttempt("verify", rateLimitContext, false);
    await logAuthSecurity({
      ...context,
      eventName: "member_email_verification",
      status: "failure",
      actorType: "member",
      actorId: session.userId,
      properties: { stage: "verify", reason: "invalid_code" },
    });
    return NextResponse.json(
      { ok: false, message: "인증 코드가 올바르지 않거나 만료되었습니다." },
      { status: 400 },
    );
  }

  if (await hasReservedMemberIdentifier({ emailNormalized: email })) {
    return NextResponse.json(
      { ok: false, message: "사용할 수 없는 이메일입니다." },
      { status: 409 },
    );
  }

  const verifiedAt = new Date().toISOString();
  const { error: memberError } = await supabase
    .from("members")
    .update({
      email,
      email_normalized: email,
      email_verified_at: verifiedAt,
      updated_at: verifiedAt,
    })
    .eq("id", session.userId)
    .is("deleted_at", null);
  if (memberError) {
    const isDuplicateEmail = memberError.code === "23505";
    return NextResponse.json(
      {
        ok: false,
        message: isDuplicateEmail
          ? "이미 다른 계정에서 사용 중인 이메일입니다."
          : "이메일 인증을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: isDuplicateEmail ? 409 : 503 },
    );
  }

  const { error: challengeError } = await supabase
    .from("member_email_challenges")
    .update({
      verified_at: verifiedAt,
      consumed_at: verifiedAt,
      attempt_count: Number(challenge.attempt_count ?? 0) + 1,
    })
    .eq("id", challenge.id)
    .is("consumed_at", null);
  if (challengeError) {
    return NextResponse.json(
      { ok: false, message: "이메일 인증 상태를 저장하지 못했습니다." },
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
  return NextResponse.json({ ok: true });
}
