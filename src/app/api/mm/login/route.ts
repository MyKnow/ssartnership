import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { setUserSession } from "@/lib/user-auth";
import { verifyPassword } from "@/lib/password";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";
import {
  MattermostApiError,
  resolveSelectableStudentByUsername,
} from "@/lib/mattermost";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  try {
    const payload = (await request.json()) as {
      username?: string;
      password?: string;
    };

    const username = normalizeMmUsername(String(payload.username ?? ""));
    const password = String(payload.password ?? "").trim();
    if (!username || !password) {
      await logAuthSecurity({
        ...context,
        eventName: "member_login",
        status: "failure",
        actorType: "guest",
        identifier: username || null,
        properties: { reason: "missing_fields" },
      });
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    if (validateMmUsername(username)) {
      await logAuthSecurity({
        ...context,
        eventName: "member_login",
        status: "failure",
        actorType: "guest",
        identifier: username,
        properties: { reason: "invalid_username" },
      });
      return NextResponse.json({ error: "invalid_username" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: memberByUsername } = await supabase
      .from("members")
      .select(
        "id,mm_user_id,mm_username,password_hash,password_salt,must_change_password,year",
      )
      .eq("mm_username", username)
      .maybeSingle();

    let member = memberByUsername;
    if (!member) {
      try {
        const resolved = await resolveSelectableStudentByUsername(username);
        if (resolved) {
          const { data: memberById } = await supabase
            .from("members")
            .select(
              "id,mm_user_id,mm_username,password_hash,password_salt,must_change_password,year",
            )
            .eq("mm_user_id", resolved.user.id)
            .maybeSingle();
          member = memberById ?? null;
        }
      } catch (error) {
        if (error instanceof MattermostApiError) {
          await logAuthSecurity({
            ...context,
            eventName: "member_login",
            status: "failure",
            actorType: "guest",
            identifier: username,
            properties: {
              reason: "team_or_channel_inaccessible",
              status: error.status,
            },
          });
          return NextResponse.json(
            {
              error: "team_or_channel_inaccessible",
              message:
                "운영용 MM 계정이 대상 팀/채널을 읽을 수 없습니다. MM_TEAM_NAME 설정과 팀 권한을 확인해 주세요.",
            },
            { status: 403 },
          );
        }
        throw error;
      }
    }

    if (!member || !member.password_hash || !member.password_salt) {
      await logAuthSecurity({
        ...context,
        eventName: "member_login",
        status: "failure",
        actorType: "guest",
        identifier: username,
        properties: { reason: "not_registered" },
      });
      return NextResponse.json({ error: "not_registered" }, { status: 401 });
    }

    const ok = verifyPassword(password, member.password_salt, member.password_hash);
    if (!ok) {
      await logAuthSecurity({
        ...context,
        eventName: "member_login",
        status: "failure",
        actorType: "member",
        actorId: member.id,
        identifier: username,
        properties: { reason: "invalid_credentials" },
      });
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    await setUserSession(member.id, Boolean(member.must_change_password));

    await logAuthSecurity({
      ...context,
      eventName: "member_login",
      status: "success",
      actorType: "member",
      actorId: member.id,
      identifier: username,
      properties: {
        mustChangePassword: Boolean(member.must_change_password),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logAuthSecurity({
      ...context,
      eventName: "member_login",
      status: "failure",
      actorType: "guest",
      properties: {
        reason: "exception",
        message: (error as Error).message,
      },
    });
    return NextResponse.json(
      { error: "login_failed", message: (error as Error).message },
      { status: 500 },
    );
  }
}
