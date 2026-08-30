import { NextResponse } from "next/server";
import { getRequestLogContext } from "@/lib/activity-logs";
import { normalizeMemberEmail } from "@/lib/member-domain";
import { hashMemberEmailIdentifier } from "@/lib/member-email-verification";
import {
  delayMemberAuthAttempt,
  getMemberAuthBlockingState,
  recordMemberAuthAttempt,
} from "@/lib/member-auth-security";
import { issueManualMemberPasswordReset } from "@/lib/member-manual-import/service.server";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { MAX_STANDARD_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";

export const runtime = "nodejs";
const GENERIC_MESSAGE = "해당 이메일 계정이 있으면 비밀번호 재설정 링크를 보냈습니다.";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }
  let body: { email?: unknown } | null = null;
  try {
    body = await readRouteJsonBodyWithinLimit<{ email?: unknown }>(request, {
      maximumBytes: MAX_STANDARD_JSON_BODY_BYTES,
      invalidMessage: "이메일 주소를 확인해 주세요.",
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
  const throttle = {
    ipAddress: context.ipAddress,
    accountIdentifier: email ? hashMemberEmailIdentifier(email) : null,
  };
  const blockingState = await getMemberAuthBlockingState("reset-password", throttle);
  if (!blockingState.ok) {
    await delayMemberAuthAttempt("reset-password", true);
    return NextResponse.json(
      {
        ok: false,
        message: "비밀번호 재설정 요청을 처리하지 못했습니다.",
      },
      { status: 503 },
    );
  }
  if (blockingState.blocked) {
    await delayMemberAuthAttempt("reset-password", true);
    return NextResponse.json({ ok: false, message: "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  if (!email) {
    await recordMemberAuthAttempt("reset-password", throttle, false);
    await delayMemberAuthAttempt("reset-password");
    return NextResponse.json({ ok: false, message: "이메일 주소를 확인해 주세요." }, { status: 400 });
  }
  try {
    const resetResult = await issueManualMemberPasswordReset(email);
    await recordMemberAuthAttempt("reset-password", throttle, resetResult.ok);
    if (!resetResult.ok) {
      await delayMemberAuthAttempt("reset-password");
    }
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch {
    await recordMemberAuthAttempt("reset-password", throttle, false).catch(() => undefined);
    await delayMemberAuthAttempt("reset-password", true);
    return NextResponse.json({ ok: false, message: "비밀번호 재설정 요청을 처리하지 못했습니다." }, { status: 503 });
  }
}
