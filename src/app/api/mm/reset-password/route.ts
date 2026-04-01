import { NextResponse } from "next/server";
import {
  getRequestLogContext,
  logAdminAudit,
  logAuthSecurity,
} from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { generateTempPassword, hashPassword } from "@/lib/password";
import {
  MattermostApiError,
  getStudentChannelConfig,
  getSenderCredentials,
  getMe,
  findUserInChannelByUserId,
  loginWithPassword,
  createDirectChannel,
  sendPost,
  resolveSelectableStudentByUsername,
  getUserImage,
} from "@/lib/mattermost";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";
import {
  buildMemberSyncLogProperties,
  syncMemberSnapshot,
} from "@/lib/mm-member-sync";
import { parseSsafyProfile } from "@/lib/mm-profile";

export const runtime = "nodejs";

const MAX_FAILS = 5;
const BLOCK_MINUTES = 60;
const RESEND_COOLDOWN_SECONDS = 60;

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  try {
    const payload = (await request.json()) as { username?: string };
    const username = normalizeMmUsername(String(payload.username ?? ""));
    if (!username) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_reset",
        status: "failure",
        actorType: "guest",
        properties: { reason: "missing_fields" },
      });
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    if (validateMmUsername(username)) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_reset",
        status: "failure",
        actorType: "guest",
        identifier: username,
        properties: { reason: "invalid_username" },
      });
      return NextResponse.json({ error: "invalid_username" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const memberSelect =
      "id,mm_user_id,mm_username,display_name,year,campus,class_number,avatar_content_type,avatar_base64,updated_at";
    const { data: memberByUsername } = await supabase
      .from("members")
      .select(memberSelect)
      .eq("mm_username", username)
      .maybeSingle();

    let member = memberByUsername;
    if (!member) {
      try {
        const resolved = await resolveSelectableStudentByUsername(username);
        if (resolved) {
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
            eventName: "member_password_reset",
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

    if (!member?.id) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_reset",
        status: "failure",
        actorType: "guest",
        identifier: username,
        properties: { reason: "not_registered" },
      });
      return NextResponse.json({ error: "not_registered" }, { status: 404 });
    }

    const senderCredentials = getSenderCredentials(member.year);
    const senderLogin = await loginWithPassword(
      senderCredentials.loginId,
      senderCredentials.password,
    );
    const sender = await getMe(senderLogin.token);
    const channelConfig = getStudentChannelConfig(member.year);
    let mmUser;
    try {
      mmUser = await findUserInChannelByUserId(
        senderLogin.token,
        member.mm_user_id,
        channelConfig,
      );
    } catch (error) {
      if (error instanceof MattermostApiError) {
        await logAuthSecurity({
          ...context,
          eventName: "member_password_reset",
          status: "failure",
          actorType: "guest",
          identifier: member.mm_user_id,
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

    if (!mmUser) {
      await logAuthSecurity({
        ...context,
        eventName: "member_password_reset",
        status: "failure",
        actorType: "member",
        actorId: member.id,
        identifier: member.mm_user_id,
        properties: { reason: "not_mm" },
      });
      return NextResponse.json({ error: "not_mm" }, { status: 404 });
    }

    const profile = parseSsafyProfile(mmUser.nickname || mmUser.username);
    const avatar = await getUserImage(senderLogin.token, member.mm_user_id);
    const syncResult = await syncMemberSnapshot(member, {
      mmUserId: member.mm_user_id,
      mmUsername: mmUser.username,
      displayName: profile.displayName ?? mmUser.nickname ?? mmUser.username,
      campus: profile.campus ?? null,
      classNumber: profile.classNumber ?? null,
      avatarFetched: Boolean(avatar),
      avatarContentType: avatar?.contentType ?? null,
      avatarBase64: avatar?.base64 ?? null,
    });

    if (syncResult.updated) {
      await logAdminAudit({
        ...context,
        action: "member_sync",
        actorId: process.env.ADMIN_ID ?? "admin",
        targetType: "member",
        targetId: member.id,
        properties: buildMemberSyncLogProperties(syncResult, {
          source: "password_reset",
        }),
      });
      member = syncResult.member;
    }

    const { data: attempt } = await supabase
      .from("password_reset_attempts")
      .select("id,count,blocked_until,first_attempt_at,created_at")
      .eq("identifier", member.mm_user_id)
      .maybeSingle();

    if (attempt?.blocked_until) {
      const blockedUntil = new Date(attempt.blocked_until);
      if (blockedUntil > new Date()) {
        await logAuthSecurity({
          ...context,
          eventName: "member_password_reset",
          status: "blocked",
          actorType: "member",
          actorId: member.id,
          identifier: member.mm_user_id,
          properties: { reason: "rate_limit" },
        });
        return NextResponse.json({ error: "blocked" }, { status: 429 });
      }
    }

    if (attempt?.created_at) {
      const createdAt = new Date(attempt.created_at);
      const diffSeconds = (Date.now() - createdAt.getTime()) / 1000;
      if (diffSeconds < RESEND_COOLDOWN_SECONDS) {
        await logAuthSecurity({
          ...context,
          eventName: "member_password_reset",
          status: "blocked",
          actorType: "member",
          actorId: member.id,
          identifier: member.mm_user_id,
          properties: { reason: "cooldown" },
        });
        return NextResponse.json({ error: "cooldown" }, { status: 429 });
      }
    }

    const tempPassword = generateTempPassword(12);
    const record = hashPassword(tempPassword);

    await supabase
      .from("members")
      .update({
        password_hash: record.hash,
        password_salt: record.salt,
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    const dmChannel = await createDirectChannel(
      senderLogin.token,
      sender.id,
      mmUser.id,
    );
    await sendPost(
      senderLogin.token,
      dmChannel.id,
      `SSARTNERSHIP 임시 비밀번호입니다.\n\n임시 비밀번호: ${tempPassword}\n보안을 위해 로그인 후 반드시 변경해 주세요.`,
    );

    const nextCount = (attempt?.count ?? 0) + 1;
    const firstAttemptAt = attempt?.first_attempt_at ?? new Date().toISOString();
    const blockedUntil =
      nextCount >= MAX_FAILS
        ? new Date(Date.now() + BLOCK_MINUTES * 60 * 1000).toISOString()
        : null;

    if (attempt?.id) {
      await supabase
        .from("password_reset_attempts")
        .update({
          count: nextCount,
          blocked_until: blockedUntil,
          first_attempt_at: firstAttemptAt,
          created_at: new Date().toISOString(),
        })
        .eq("id", attempt.id);
    } else {
      await supabase.from("password_reset_attempts").insert({
        identifier: member.mm_user_id,
        count: nextCount,
        blocked_until: blockedUntil,
        first_attempt_at: firstAttemptAt,
        created_at: new Date().toISOString(),
      });
    }

    await logAuthSecurity({
      ...context,
      eventName: "member_password_reset",
      status: "success",
      actorType: "member",
      actorId: member.id,
      identifier: member.mm_user_id,
      properties: {
        mustChangePassword: true,
        mmUserId: member.mm_user_id,
        mmUsername: member.mm_username,
        year: member.year,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await logAuthSecurity({
      ...context,
      eventName: "member_password_reset",
      status: "failure",
      actorType: "guest",
      properties: {
        reason: "exception",
        message: (error as Error).message,
      },
    });
    return NextResponse.json(
      { error: "reset_failed", message: (error as Error).message },
      { status: 500 },
    );
  }
}
