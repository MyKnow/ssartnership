import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { clearUserSession } from "@/lib/user-auth";
import { requireMemberApiSession } from "@/lib/member-api-session";
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
    properties: { retentionDays: 30 },
  });

  return NextResponse.json({ ok: true });
}
