import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { clearAdminSession } from "@/lib/auth";
import { clearUserSession, getSignedUserSession } from "@/lib/user-auth";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request)) {
    await logAuthSecurity({
      ...context,
      eventName: "member_logout",
      status: "failure",
      actorType: "guest",
      properties: { reason: "same_origin_failed" },
    });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getSignedUserSession();
  await Promise.all([
    clearUserSession(),
    clearAdminSession(),
  ]);
  await logAuthSecurity({
    ...context,
    eventName: "member_logout",
    status: "success",
    actorType: session?.userId ? "member" : "guest",
    actorId: session?.userId ?? null,
  });
  return NextResponse.json({ ok: true });
}
