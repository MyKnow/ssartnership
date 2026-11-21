import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { clearAdminSession } from "@/lib/auth";
import {
  clearUserSession,
  getSignedUserSession,
  revokeUserSessions,
} from "@/lib/user-auth";
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
  // Logout ends every device's session (decision recorded in
  // docs/security/admin-access-control.md). A failed revocation still clears
  // this browser and is recorded so the operator can follow up.
  const allDevicesRevoked = session?.userId
    ? await revokeUserSessions(session).catch(() => false)
    : false;
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
    properties: session?.userId ? { allDevicesRevoked } : undefined,
  });
  return NextResponse.json({ ok: true, allDevicesRevoked });
}
