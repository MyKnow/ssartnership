import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  delayMemberAuthAttempt,
  getMemberAuthAttemptScope,
  getMemberAuthBlockingState,
  recordMemberAuthAttempt,
} from "@/lib/member-auth-security";
import {
  MattermostCodeVerificationError,
  issueMattermostVerificationCode,
  type MattermostVerificationPurpose,
} from "@/lib/mattermost-code-verification";
import { parseMattermostVerificationRequest } from "@/lib/mattermost-code-input";
import { hashOpaqueToken } from "@/lib/password";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

function parsePurpose(value: unknown): MattermostVerificationPurpose | null {
  return value === "signup" || value === "reset_password" ? value : null;
}

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request, { allowedContentTypes: ["application/json"] })) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const purpose = parsePurpose(
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).purpose
      : null,
  );
  const parsed = parseMattermostVerificationRequest(body);
  if (!purpose || !parsed.ok) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const throttleContext = {
    ipAddress: context.ipAddress ?? null,
    accountIdentifier: hashOpaqueToken(`mm-code:${parsed.data.username}`),
  };
  const blocked = await getMemberAuthBlockingState("mattermost-code-issue", throttleContext);
  if (blocked) {
    await logAuthSecurity({
      ...context,
      eventName: "member_mattermost_code",
      status: "blocked",
      actorType: "guest",
      properties: {
        purpose,
        phase: "issue",
        reason: "rate_limit",
        scope: getMemberAuthAttemptScope(blocked.identifier),
      },
    });
    await delayMemberAuthAttempt("mattermost-code-issue", true);
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const issueStartedAt = Date.now();
  try {
    const { telemetry, ...result } = await issueMattermostVerificationCode({
      purpose,
      request: parsed.data,
    });
    await recordMemberAuthAttempt("mattermost-code-issue", throttleContext, true);
    await logAuthSecurity({
      ...context,
      eventName: "member_mattermost_code",
      status: "success",
      actorType: "guest",
      properties: {
        purpose,
        phase: "issue",
        generation: parsed.data.generation,
        deliveryStatus: telemetry.deliveryStatus,
        deliveryErrorCode: telemetry.deliveryErrorCode,
        targetLookupMs: telemetry.targetLookupMs,
        templateMs: telemetry.templateMs,
        reserveCodeMs: telemetry.reserveCodeMs,
        sendDmMs: telemetry.sendDmMs,
        deliveryMarkMs: telemetry.deliveryMarkMs,
        totalMs: telemetry.totalMs,
      },
    });
    return NextResponse.json({ ok: true, ...result }, { status: 202 });
  } catch (error) {
    const rateLimited = error instanceof MattermostCodeVerificationError
      && error.code === "rate_limited";
    await recordMemberAuthAttempt("mattermost-code-issue", throttleContext, false);
    await delayMemberAuthAttempt("mattermost-code-issue", rateLimited);
    await logAuthSecurity({
      ...context,
      eventName: "member_mattermost_code",
      status: "failure",
      actorType: "guest",
      properties: {
        purpose,
        phase: "issue",
        reason: rateLimited ? "rate_limit" : "unavailable",
        totalMs: Date.now() - issueStartedAt,
      },
    });
    return NextResponse.json(
      { ok: false, error: rateLimited ? "rate_limited" : "unavailable" },
      { status: rateLimited ? 429 : 503 },
    );
  }
}
