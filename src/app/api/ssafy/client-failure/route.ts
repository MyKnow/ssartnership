import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { consumeProductEventQuota } from "@/lib/product-event-throttle";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { parseSsafyVerifyClientFailureReport } from "@/lib/ssafy-verify/client-failure-report";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (
    !isTrustedSameOriginRequest(request, {
      allowedContentTypes: ["application/json"],
    })
  ) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const report = parseSsafyVerifyClientFailureReport(
    await request.json().catch(() => null),
  );
  if (!report) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const context = getRequestLogContext(request);
  if (
    !consumeProductEventQuota({
      eventName: "ssafy_verify_client_failure",
      ipAddress: context.ipAddress,
    })
  ) {
    return NextResponse.json({ ok: true, throttled: true }, { status: 202 });
  }

  await logAuthSecurity({
    ...context,
    eventName:
      report.purpose === "reset-password"
        ? "member_password_reset_ssafy"
        : "member_ssafy_verify",
    status: "failure",
    actorType: "guest",
    identifier: report.requestId,
    properties: {
      source: "client_failure_report",
      reason: report.errorCode,
      phase: report.phase,
    },
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
