import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { setUserSession } from "@/lib/user-auth";
import { verifyPassword } from "@/lib/password";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";
import {
  getMemberRequiredPolicyStatus,
} from "@/lib/policy-documents";
import {
  MattermostApiError,
  resolveSelectableMemberByUsername,
} from "@/lib/mattermost";
import { parseSsafyProfileFromUser } from "@/lib/mm-profile";
import {
  findMmUserDirectoryEntryByUsername,
  upsertMmUserDirectorySnapshot,
} from "@/lib/mm-directory";

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
    const memberSelect =
      "id,mm_user_id,mm_username,password_hash,password_salt,must_change_password,year";

    let member = null;
    const directoryEntry = await findMmUserDirectoryEntryByUsername(username);
    if (directoryEntry?.mm_user_id) {
      const { data: memberById } = await supabase
        .from("members")
        .select(memberSelect)
        .eq("mm_user_id", directoryEntry.mm_user_id)
        .maybeSingle();
      member = memberById ?? null;
    } else {
      try {
        const resolved = await resolveSelectableMemberByUsername(username);
        if (resolved) {
          const profile = parseSsafyProfileFromUser(resolved.user);
          await upsertMmUserDirectorySnapshot({
            mmUserId: resolved.user.id,
            mmUsername: resolved.user.username,
            displayName:
              profile.displayName ?? resolved.user.nickname ?? resolved.user.username,
            campus: profile.campus ?? null,
            isStaff: Boolean(profile.isStaff),
            sourceYears: [resolved.year],
          });
          const { data: memberById } = await supabase
            .from("members")
            .select(memberSelect)
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

    const policyStatus = await getMemberRequiredPolicyStatus(member.id);
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
        requiresConsent: policyStatus.requiresConsent,
      },
    });
    return NextResponse.json({
      ok: true,
      requiresConsent: policyStatus.requiresConsent,
    });
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
