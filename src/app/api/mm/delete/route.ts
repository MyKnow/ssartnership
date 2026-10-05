import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { clearUserSession } from "@/lib/user-auth";
import { requireMemberApiSession } from "@/lib/member-api-session";
import {
  getMemberRecentAuthErrorBody,
  verifyMemberRecentAuthentication,
} from "@/lib/member-recent-auth.server";
import { MAX_STANDARD_JSON_BODY_BYTES } from "@/lib/request-body-limit";
import {
  RouteJsonBodyError,
  readRouteJsonBodyWithinLimit,
} from "@/lib/route-json-body";
import { clearAdminSession } from "@/lib/auth";
import { softDeleteMember } from "@/lib/member-lifecycle";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request)) {
    await logAuthSecurity({
      ...context,
      eventName: "member_delete",
      status: "failure",
      actorType: "guest",
      properties: { reason: "same_origin_failed" },
    });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const auth = await requireMemberApiSession();
  if ("response" in auth) {
    const unauthorized = auth.response.status === 401;
    await logAuthSecurity({
      ...context,
      eventName: "member_delete",
      status: "failure",
      actorType: unauthorized ? "guest" : "member",
      properties: {
        reason: unauthorized ? "unauthorized" : "password_change_required",
      },
    });
    return auth.response;
  }
  const { session } = auth;

  let body: { currentPassword?: unknown } | null = null;
  try {
    body = await readRouteJsonBodyWithinLimit<{ currentPassword?: unknown } | null>(
      request,
      {
        maximumBytes: MAX_STANDARD_JSON_BODY_BYTES,
        invalidMessage: "요청을 확인해 주세요.",
      },
    );
  } catch (error) {
    if (error instanceof RouteJsonBodyError && error.code === "body_too_large") {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }
    // An empty or non-JSON body means "no current password provided".
  }

  const recentAuth = await verifyMemberRecentAuthentication({
    session,
    currentPassword: body?.currentPassword,
    ipAddress: context.ipAddress ?? null,
  });
  if (!recentAuth.ok) {
    await logAuthSecurity({
      ...context,
      eventName: "member_delete",
      status: recentAuth.code === "recent_auth_blocked" ? "blocked" : "failure",
      actorType: "member",
      actorId: session.userId,
      properties: { reason: recentAuth.code },
    });
    const denied = getMemberRecentAuthErrorBody(recentAuth.code);
    return NextResponse.json(denied.body, { status: denied.status });
  }

  try {
    const deleted = await softDeleteMember(session.userId);
    if (!deleted) {
      return NextResponse.json({ error: "delete_failed" }, { status: 409 });
    }
  } catch {
    await logAuthSecurity({
      ...context,
      eventName: "member_delete",
      status: "failure",
      actorType: "member",
      actorId: session.userId,
      properties: { reason: "soft_delete_failed" },
    });
    return NextResponse.json({ error: "delete_failed" }, { status: 503 });
  }

  await clearUserSession();
  await clearAdminSession();

  await logAuthSecurity({
    ...context,
    eventName: "member_delete",
    status: "success",
    actorType: "member",
    actorId: session.userId,
    properties: { retentionDays: 30, recentAuth: recentAuth.method },
  });

  return NextResponse.json({ ok: true });
}
