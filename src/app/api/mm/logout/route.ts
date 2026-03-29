import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { getSignedUserSession } from "@/lib/user-auth";
import { clearUserSession } from "@/lib/user-auth";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
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
