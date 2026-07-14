import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { hashOpaqueToken, hashPassword, isValidPassword } from "@/lib/password";
import {
  delayMemberAuthAttempt,
  getMemberAuthBlockingState,
  recordMemberAuthAttempt,
} from "@/lib/member-auth-security";
import { completeManualMemberPasswordAction } from "@/lib/member-manual-import/service.server";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { setUserSession } from "@/lib/user-auth";

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
  const throttle = { ipAddress: context.ipAddress, accountIdentifier: tokenHash };
  if (await getMemberAuthBlockingState("manual-password-action", throttle)) {
    await delayMemberAuthAttempt("manual-password-action", true);
    return NextResponse.json({ ok: false, message: "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  if (!token || password !== confirmPassword || !isValidPassword(password)) {
    await recordMemberAuthAttempt("manual-password-action", throttle, false);
    await delayMemberAuthAttempt("manual-password-action");
    return NextResponse.json({ ok: false, message: "비밀번호는 8~64자이며 영문, 숫자, 특수문자를 모두 포함해야 합니다." }, { status: 400 });
  }
  try {
    const record = hashPassword(password);
    const completion = await completeManualMemberPasswordAction({
      token,
      passwordHash: record.hash,
      passwordSalt: record.salt,
    });
    if (!completion) {
      await recordMemberAuthAttempt("manual-password-action", throttle, false);
      await delayMemberAuthAttempt("manual-password-action");
      return NextResponse.json({ ok: false, message: "비밀번호 설정 링크가 만료되었거나 이미 사용되었습니다." }, { status: 400 });
    }
    await setUserSession(completion.memberId, false, {
      persistent: true,
      authenticationMethod: completion.deliveryChannel === "mattermost" ? "mattermost" : "email",
      freshAuthentication: true,
    });
    await recordMemberAuthAttempt("manual-password-action", throttle, true);
    await logAuthSecurity({ ...context, eventName: "member_password_reset_complete", status: "success", actorType: "member", actorId: completion.memberId, properties: { purpose: "member_password_action", deliveryChannel: completion.deliveryChannel } });
    return NextResponse.json({ ok: true });
  } catch {
    await recordMemberAuthAttempt("manual-password-action", throttle, false);
    await delayMemberAuthAttempt("manual-password-action", true);
    return NextResponse.json({ ok: false, message: "비밀번호를 설정하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}
