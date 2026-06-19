import { NextRequest, NextResponse } from "next/server";
import { logAuthSecurity, getRequestLogContext } from "@/lib/activity-logs";
import {
  resolveAdminAccountFromUserSession,
  sanitizeAdminReturnTo,
} from "@/lib/admin-session-bridge";
import { setAdminSession } from "@/lib/auth";
import { getSignedUserSession } from "@/lib/user-auth";

export async function GET(request: NextRequest) {
  const returnTo = sanitizeAdminReturnTo(
    request.nextUrl.searchParams.get("returnTo"),
    "/admin",
  );
  const context = getRequestLogContext(request);
  const memberSession = await getSignedUserSession();

  if (!memberSession?.userId) {
    await logAuthSecurity({
      ...context,
      eventName: "admin_access",
      status: "blocked",
      actorType: "guest",
      properties: {
        reason: "access_denied",
        stage: "session_bridge",
      },
    });
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(loginUrl);
  }

  const adminAccount = await resolveAdminAccountFromUserSession(memberSession.userId);
  if (!adminAccount) {
    await logAuthSecurity({
      ...context,
      eventName: "admin_access",
      status: "blocked",
      actorType: "member",
      actorId: memberSession.userId,
      properties: {
        reason: "not_admin",
        stage: "session_bridge",
      },
    });
    const deniedUrl = new URL("/admin/denied", request.url);
    deniedUrl.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(deniedUrl);
  }

  await setAdminSession(adminAccount);
  await logAuthSecurity({
    ...context,
    eventName: "admin_login",
    status: "success",
    actorType: "admin",
    actorId: adminAccount.id,
    identifier: adminAccount.loginId,
    properties: {
      method: "member_session_bridge",
      memberId: memberSession.userId,
      returnTo,
    },
  });

  return NextResponse.redirect(new URL(returnTo, request.url));
}
