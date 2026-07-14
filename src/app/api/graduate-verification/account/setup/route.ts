import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { hashOpaqueToken, hashPassword, isValidPassword } from "@/lib/password";
import {
  isGraduateVerificationBlocked,
  recordGraduateVerificationAttempt,
} from "@/lib/graduate-verification-rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { setUserSession } from "@/lib/user-auth";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
    password?: unknown;
    confirmPassword?: unknown;
  } | null;
  const token = String(body?.token ?? "").trim();
  const password = String(body?.password ?? "");
  const confirmPassword = String(body?.confirmPassword ?? "");
  const tokenHash = token ? hashOpaqueToken(token) : "missing";
  const rateLimitContext = {
    route: "graduate-password-setup" as const,
    ipAddress: context.ipAddress,
    accountIdentifier: tokenHash,
  };
  if (await isGraduateVerificationBlocked(rateLimitContext)) {
    return NextResponse.json({ ok: false, message: "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  if (!token || password !== confirmPassword || !isValidPassword(password)) {
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    return NextResponse.json(
      { ok: false, message: "비밀번호는 8~64자이며 영문, 숫자, 특수문자를 모두 포함해야 합니다." },
      { status: 400 },
    );
  }

  try {
    const passwordRecord = hashPassword(password);
    const { data, error } = await getSupabaseAdminClient().rpc(
      "complete_graduate_password_action",
      {
        p_token_hash: tokenHash,
        p_password_hash: passwordRecord.hash,
        p_password_salt: passwordRecord.salt,
      },
    );
    const memberId = typeof data === "string" ? data : null;
    if (error || !memberId) {
      await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
      return NextResponse.json({ ok: false, message: "비밀번호 설정 링크가 만료되었거나 이미 사용되었습니다." }, { status: 400 });
    }
    await setUserSession(memberId, false, {
      persistent: true,
      authenticationMethod: "email",
      freshAuthentication: true,
    });
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: true });
    await logAuthSecurity({
      ...context,
      eventName: "graduate_password_setup",
      status: "success",
      actorType: "member",
      actorId: memberId,
      properties: { purpose: "initial_or_reset" },
    });
    return NextResponse.json({ ok: true });
  } catch {
    await recordGraduateVerificationAttempt({ ...rateLimitContext, success: false });
    await logAuthSecurity({
      ...context,
      eventName: "graduate_password_setup",
      status: "failure",
      actorType: "guest",
      properties: { reason: "exception" },
    });
    return NextResponse.json({ ok: false, message: "비밀번호를 설정하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}
