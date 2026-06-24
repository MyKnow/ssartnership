import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getSignedUserSession, clearUserSession } from "@/lib/user-auth";
import { getMemberAuthCleanupKeys } from "@/lib/member-auth-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request)) {
    await logAuthSecurity({
      ...context,
      eventName: "member_delete",
      status: "failure",
      actorType: "guest",
      properties: { reason: "untrusted_origin" },
    });
    return NextResponse.json({ error: "invalid_request" }, { status: 403 });
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    await logAuthSecurity({
      ...context,
      eventName: "member_delete",
      status: "failure",
      actorType: "guest",
      properties: { reason: "unauthorized" },
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: member } = await supabase
    .from("members")
    .select("mm_user_id,mm_username")
    .eq("id", session.userId)
    .maybeSingle();

  if (member?.mm_user_id) {
    await supabase
      .from("password_reset_attempts")
      .delete()
      .eq("identifier", member.mm_user_id);
  }
  if (member?.mm_username && member.mm_username !== member.mm_user_id) {
    await supabase
      .from("password_reset_attempts")
      .delete()
      .eq("identifier", member.mm_username);
  }
  const memberAuthCleanupKeys = getMemberAuthCleanupKeys([
    member?.mm_user_id,
    member?.mm_username,
    session.userId,
  ]);
  if (memberAuthCleanupKeys.length > 0) {
    await supabase
      .from("member_auth_attempts")
      .delete()
      .in("identifier", memberAuthCleanupKeys);
  }

  await supabase.from("members").delete().eq("id", session.userId);
  await clearUserSession();

  await logAuthSecurity({
    ...context,
    eventName: "member_delete",
    status: "success",
    actorType: "member",
    actorId: session.userId,
    identifier: member?.mm_user_id ?? member?.mm_username ?? null,
  });

  return NextResponse.json({ ok: true });
}
