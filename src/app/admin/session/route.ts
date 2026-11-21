import { NextRequest, NextResponse } from "next/server";
import { logAuthSecurity, getRequestLogContext } from "@/lib/activity-logs";
import {
  isMemberSessionFreshForAdminBridge,
  resolveAdminAccountFromUserSession,
  sanitizeAdminReturnTo,
} from "@/lib/admin-session-bridge";
import { clearAdminSession, setAdminSession } from "@/lib/auth";
import { buildTrustedRedirectUrl, isTrustedAdminSessionNavigation } from "@/lib/request-guards";
import { clearUserSession, getSignedUserSession } from "@/lib/user-auth";

export async function GET(request: NextRequest) {
  const returnTo = sanitizeAdminReturnTo(
    request.nextUrl.searchParams.get("returnTo"),
    "/admin",
  );
  const context = getRequestLogContext(request);

  if (!isTrustedAdminSessionNavigation(request)) {
    await logAuthSecurity({
      ...context,
      eventName: "admin_access",
      status: "blocked",
      actorType: "guest",
      properties: {
        reason: "same_origin_failed",
        stage: "session_bridge",
      },
    });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

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
    const loginUrl = buildTrustedRedirectUrl("/auth/login", request.url);
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
    const deniedUrl = buildTrustedRedirectUrl("/admin/denied", request.url);
    deniedUrl.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(deniedUrl);
  }

  if (!isMemberSessionFreshForAdminBridge(memberSession)) {
    // Promotion to admin needs a recent credential check instead of riding
    // the 7-day member session. Clearing the member cookie also prevents a
    // redirect loop through the logged-in /auth/login redirect. Non-admin
    // members were already sent to /admin/denied above, so following an
    // /admin link never signs an ordinary member out.
    await Promise.all([clearUserSession(), clearAdminSession()]);
    await logAuthSecurity({
      ...context,
      eventName: "admin_access",
      status: "blocked",
      actorType: "member",
      actorId: memberSession.userId,
      properties: {
        reason: "reauthentication_required",
        stage: "session_bridge",
      },
    });
    const loginUrl = buildTrustedRedirectUrl("/auth/login", request.url);
    loginUrl.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(loginUrl);
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

  return NextResponse.redirect(buildTrustedRedirectUrl(returnTo, request.url));
}
