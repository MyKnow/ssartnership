import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { clearPartnerSession, getPartnerSession } from "@/lib/partner-session";

export async function GET(request: Request) {
  const context = getRequestLogContext(request);
  const session = await getPartnerSession();

  await clearPartnerSession();

  if (session) {
    await logAuthSecurity({
      ...context,
      eventName: "partner_logout",
      status: "success",
      actorType: "guest",
      identifier: session.loginId,
      properties: {
        accountId: session.accountId,
        companyCount: session.companyIds.length,
      },
    });
  }

  return NextResponse.redirect(new URL("/partner/login", request.url));
}
