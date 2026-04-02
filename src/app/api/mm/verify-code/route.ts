import { NextResponse } from "next/server";
import {
  getRequestLogContext,
  logAdminAudit,
  logAuthSecurity,
} from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { hashCode } from "@/lib/mm-verification";
import { setUserSession } from "@/lib/user-auth";
import { hashPassword, isValidPassword } from "@/lib/password";
import { parseSsafyProfile } from "@/lib/mm-profile";
import {
  buildMemberSyncLogProperties,
  type MemberRow,
  syncMemberSnapshot,
} from "@/lib/mm-member-sync";
import {
  MattermostApiError,
  getUserImage,
  resolveSelectableStudentByUsername,
} from "@/lib/mattermost";
import {
  normalizeMmUsername,
  PASSWORD_POLICY_MESSAGE,
  validateMmUsername,
} from "@/lib/validation";

export const runtime = "nodejs";

const MAX_FAILS = 5;
const BLOCK_MINUTES = 60;

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  try {
    const payload = (await request.json()) as {
      username?: string;
      code?: string;
      password?: string;
    };

    const username = normalizeMmUsername(String(payload.username ?? ""));
    const code = String(payload.code ?? "").trim().toUpperCase();
    const password = String(payload.password ?? "").trim();
    if (!username || !code || !password) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
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
        eventName: "member_signup_complete",
        status: "failure",
        actorType: "guest",
        identifier: username,
        properties: { reason: "invalid_username" },
      });
      return NextResponse.json({ error: "invalid_username" }, { status: 400 });
    }
    if (!isValidPassword(password)) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
        status: "failure",
        actorType: "guest",
        identifier: username,
        properties: { reason: "invalid_password" },
      });
      return NextResponse.json(
        { error: "invalid_password", message: PASSWORD_POLICY_MESSAGE },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdminClient();
    let resolvedStudent;
    try {
      resolvedStudent = await resolveSelectableStudentByUsername(username);
    } catch (error) {
      if (error instanceof MattermostApiError) {
        await logAuthSecurity({
          ...context,
          eventName: "member_signup_complete",
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

    if (!resolvedStudent) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
        status: "failure",
        actorType: "guest",
        identifier: username,
        properties: { reason: "not_mm" },
      });
      return NextResponse.json({ error: "not_mm" }, { status: 404 });
    }

    const mmUserId = resolvedStudent.user.id;
    const { data: attempt } = await supabase
      .from("mm_verification_attempts")
      .select("id,count,blocked_until,first_attempt_at")
      .eq("identifier", mmUserId)
      .maybeSingle();

    if (attempt?.blocked_until) {
      const blockedUntil = new Date(attempt.blocked_until);
      if (blockedUntil > new Date()) {
        await logAuthSecurity({
          ...context,
          eventName: "member_signup_complete",
          status: "blocked",
          actorType: "guest",
          identifier: mmUserId,
          properties: { reason: "verification_blocked" },
        });
        return NextResponse.json({ error: "blocked" }, { status: 429 });
      }
    }

    const { data: codeRow } = await supabase
      .from("mm_verification_codes")
      .select("*")
      .eq("mm_user_id", mmUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!codeRow) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
        status: "failure",
        actorType: "guest",
        identifier: mmUserId,
        properties: { reason: "missing_code" },
      });
      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    }

    if (new Date(codeRow.expires_at) < new Date()) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
        status: "failure",
        actorType: "guest",
        identifier: mmUserId,
        properties: { reason: "expired" },
      });
      return NextResponse.json({ error: "expired" }, { status: 400 });
    }

    if (codeRow.code_hash !== hashCode(code)) {
      const nextCount = (attempt?.count ?? 0) + 1;
      const firstAttemptAt = attempt?.first_attempt_at ?? new Date().toISOString();
      const blockedUntil =
        nextCount >= MAX_FAILS
          ? new Date(Date.now() + BLOCK_MINUTES * 60 * 1000).toISOString()
          : null;

      if (attempt?.id) {
        await supabase
          .from("mm_verification_attempts")
          .update({
            count: nextCount,
            blocked_until: blockedUntil,
            first_attempt_at: firstAttemptAt,
          })
          .eq("id", attempt.id);
      } else {
        await supabase.from("mm_verification_attempts").insert({
          identifier: mmUserId,
          count: nextCount,
          blocked_until: blockedUntil,
          first_attempt_at: firstAttemptAt,
        });
      }

      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
        status: blockedUntil ? "blocked" : "failure",
        actorType: "guest",
        identifier: mmUserId,
        properties: {
          reason: "invalid_code",
          attemptCount: nextCount,
        },
      });
      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    }

    const memberPromise = supabase
      .from("members")
      .select(
        "id,mm_user_id,mm_username,display_name,year,campus,class_number,avatar_content_type,avatar_base64,updated_at",
      )
      .eq("mm_user_id", mmUserId)
      .maybeSingle();
    const avatarPromise = getUserImage(resolvedStudent.senderToken, mmUserId);
    const passwordRecord = hashPassword(password);
    const { data: memberData } = await memberPromise;
    const member = (memberData as MemberRow | null) ?? null;
    const avatar = await avatarPromise;
    const profile = parseSsafyProfile(
      resolvedStudent.user.nickname || resolvedStudent.user.username,
    );
    const snapshot = {
      mmUserId,
      mmUsername: resolvedStudent.user.username,
      displayName:
        profile.displayName ??
        resolvedStudent.user.nickname ??
        resolvedStudent.user.username,
      campus: profile.campus ?? null,
      classNumber: profile.classNumber ?? null,
      avatarFetched: Boolean(avatar),
      avatarContentType: avatar?.contentType ?? null,
      avatarBase64: avatar?.base64 ?? null,
    };

    const year = codeRow.year ?? member?.year ?? null;

    let authenticatedMemberId = member?.id ?? null;
    let nextMember: MemberRow | null = member ?? null;

    if (member?.id) {
      const syncResult = await syncMemberSnapshot(member, snapshot);
      if (syncResult.updated) {
        await logAdminAudit({
          ...context,
          action: "member_sync",
          actorId: process.env.ADMIN_ID ?? "admin",
          targetType: "member",
          targetId: member.id,
          properties: buildMemberSyncLogProperties(syncResult, {
            source: "signup_complete",
          }),
        });
      }
      nextMember = syncResult.member;

      await supabase
        .from("members")
        .update({
          mm_user_id: mmUserId,
          mm_username: snapshot.mmUsername,
          display_name: snapshot.displayName,
          year: year ?? codeRow.year,
          campus: snapshot.campus,
          class_number: snapshot.classNumber,
          avatar_content_type: snapshot.avatarFetched
            ? snapshot.avatarContentType
            : nextMember.avatar_content_type ?? null,
          avatar_base64: snapshot.avatarFetched
            ? snapshot.avatarBase64
            : nextMember.avatar_base64 ?? null,
          password_hash: passwordRecord.hash,
          password_salt: passwordRecord.salt,
          must_change_password: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", member.id);
      await setUserSession(member.id, false);
    } else {
      const { data: inserted } = await supabase
        .from("members")
        .insert({
          mm_user_id: mmUserId,
          mm_username: snapshot.mmUsername,
          display_name: snapshot.displayName,
          year: year ?? codeRow.year,
          campus: snapshot.campus,
          class_number: snapshot.classNumber,
          avatar_content_type: snapshot.avatarContentType,
          avatar_base64: snapshot.avatarBase64,
          password_hash: passwordRecord.hash,
          password_salt: passwordRecord.salt,
          must_change_password: false,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (inserted?.id) {
        authenticatedMemberId = inserted.id;
        await setUserSession(inserted.id, false);
      }
    }

    await supabase
      .from("mm_verification_attempts")
      .delete()
      .eq("identifier", mmUserId);
    await supabase
      .from("mm_verification_codes")
      .delete()
      .eq("mm_user_id", mmUserId);

    await logAuthSecurity({
      ...context,
      eventName: "member_signup_complete",
      status: "success",
      actorType: "member",
      actorId: authenticatedMemberId,
      identifier: mmUserId,
      properties: {
        year: year ?? codeRow.year ?? null,
        campus: snapshot.campus,
        classNumber: snapshot.classNumber,
        existingMember: Boolean(member?.id),
        mmUsername: snapshot.mmUsername,
        mmUserId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await logAuthSecurity({
      ...context,
      eventName: "member_signup_complete",
      status: "failure",
      actorType: "guest",
      properties: {
        reason: "exception",
        message: (error as Error).message,
      },
    });
    return NextResponse.json(
      { error: "verify_failed", message: (error as Error).message },
      { status: 500 },
    );
  }
}
