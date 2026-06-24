import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSignedUserSession } from "@/lib/user-auth";
import { clearUserSession } from "@/lib/user-auth";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request)) {
    await logAuthSecurity({
      ...context,
      eventName: "member_logout",
      status: "failure",
      actorType: "guest",
      properties: { reason: "untrusted_origin" },
    });
    return NextResponse.json({ error: "invalid_request" }, { status: 403 });
  }

  const session = await getSignedUserSession();
  await clearUserSession();
  await logAuthSecurity({
    ...context,
    eventName: "member_logout",
    status: "success",
    actorType: session?.userId ? "member" : "guest",
    actorId: session?.userId ?? null,
  });
  return NextResponse.json({ ok: true });
}
