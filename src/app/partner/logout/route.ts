import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { clearPartnerSession, getPartnerSession } from "@/lib/partner-session";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request)) {
    await logAuthSecurity({
      ...context,
      eventName: "partner_logout",
      status: "failure",
      actorType: "guest",
      properties: { reason: "same_origin_failed" },
    });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getPartnerSession();

  await clearPartnerSession();

  if (session) {
    await logAuthSecurity({
      ...context,
      eventName: "partner_logout",
      status: "success",
      actorType: "partner",
      actorId: session.accountId,
      identifier: session.loginId,
      properties: {
        accountId: session.accountId,
        companyCount: session.companyIds.length,
      },
    });
  }

  return NextResponse.redirect(new URL("/partner/login", request.url), 303);
}
