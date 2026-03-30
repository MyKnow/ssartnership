import { NextResponse } from "next/server";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { generateCode, hashCode } from "@/lib/mm-verification";
import {
  createDirectChannel,
  getMe,
  getSenderCredentials,
  findUserInChannelByUsername,
  getUserImage,
  loginWithPassword,
  sendPost,
} from "@/lib/mattermost";
import { parseSsafyProfile } from "@/lib/mm-profile";
import { getSelectableSsafyYearText, isSelectableSsafyYear } from "@/lib/ssafy-year";
import {
  normalizeMmUsername,
  parseSsafyYearValue,
  validateSsafyYear,
  validateMmUsername,
} from "@/lib/validation";

export const runtime = "nodejs";

const CODE_TTL_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  try {
    const payload = (await request.json()) as {
      username?: string;
      year?: string | number;
    };

    const username = normalizeMmUsername(String(payload.username ?? ""));
    const yearError = validateSsafyYear(payload.year);
    const year = parseSsafyYearValue(payload.year);
    if (!username) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_code_request",
        status: "failure",
        actorType: "guest",
        properties: { reason: "missing_fields" },
      });
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    if (validateMmUsername(username)) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_code_request",
        status: "failure",
        actorType: "guest",
        identifier: username,
        properties: { reason: "invalid_username" },
      });
      return NextResponse.json({ error: "invalid_username" }, { status: 400 });
    }
    if (yearError || year === null) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_code_request",
        status: "failure",
        actorType: "guest",
        identifier: username || null,
        properties: { reason: "invalid_year" },
      });
      return NextResponse.json({ error: "invalid_year" }, { status: 400 });
    }
    if (!isSelectableSsafyYear(year)) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_code_request",
        status: "failure",
        actorType: "guest",
        identifier: username || null,
        properties: {
          reason: "inactive_year",
          year,
        },
      });
      return NextResponse.json(
        {
          error: "invalid_year",
          message: `회원가입은 현재 운영 중인 기수인 ${getSelectableSsafyYearText()}만 선택할 수 있습니다.`,
        },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdminClient();
    const { data: existing } = await supabase
      .from("mm_verification_codes")
      .select("created_at")
      .eq("mm_username", username)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.created_at) {
      const createdAt = new Date(existing.created_at);
      const now = new Date();
      const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;
      if (diffSeconds < RESEND_COOLDOWN_SECONDS) {
        await logAuthSecurity({
          ...context,
          eventName: "member_signup_code_request",
          status: "blocked",
          actorType: "guest",
          identifier: username,
          properties: { reason: "cooldown" },
        });
        return NextResponse.json(
          { error: "cooldown" },
          { status: 429 },
        );
      }
    }

    const { data: existingMember } = await supabase
      .from("members")
      .select("id")
      .eq("mm_username", username)
      .maybeSingle();

    if (existingMember?.id) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_code_request",
        status: "failure",
        actorType: "member",
        actorId: existingMember.id,
        identifier: username,
        properties: { reason: "already_registered" },
      });
      return NextResponse.json({ error: "already_registered" }, { status: 409 });
    }

    const senderCredentials = getSenderCredentials();
    const senderLogin = await loginWithPassword(
      senderCredentials.loginId,
      senderCredentials.password,
    );
    const sender = await getMe(senderLogin.token);
    const teamName = process.env.MM_TEAM_NAME ?? "s15public";
    const channelName = process.env.MM_STUDENT_CHANNEL ?? "off-topic";
    const targetUser = await findUserInChannelByUsername(
      senderLogin.token,
      teamName,
      channelName,
      username,
    );
    if (!targetUser) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_code_request",
        status: "failure",
        actorType: "guest",
        identifier: username,
        properties: { reason: "not_student" },
      });
      return NextResponse.json({ error: "not_student" }, { status: 404 });
    }

    const profile = parseSsafyProfile(
      targetUser.nickname || targetUser.username,
    );
    const avatar = await getUserImage(senderLogin.token, targetUser.id);

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await supabase.from("mm_verification_attempts").delete().eq("identifier", username);
    await supabase.from("mm_verification_codes").delete().eq("mm_username", username);

    await supabase.from("mm_verification_codes").insert({
      code_hash: hashCode(code),
      expires_at: expiresAt.toISOString(),
      mm_user_id: targetUser.id,
      mm_username: targetUser.username,
      display_name:
        profile.displayName ?? targetUser.nickname ?? targetUser.username,
      year,
      campus: profile.campus ?? null,
      class_number: profile.classNumber ?? null,
      avatar_content_type: avatar?.contentType ?? null,
      avatar_base64: avatar?.base64 ?? null,
    });

    const dmChannel = await createDirectChannel(
      senderLogin.token,
      sender.id,
      targetUser.id,
    );
    await sendPost(
      senderLogin.token,
      dmChannel.id,
      `SSARTNERSHIP 인증코드입니다.\n\n인증코드: ${code}\n유효시간: ${CODE_TTL_MINUTES}분`,
    );

    await logAuthSecurity({
      ...context,
      eventName: "member_signup_code_request",
      status: "success",
      actorType: "guest",
      identifier: username,
      properties: {
        mmUserId: targetUser.id,
        year,
        campus: profile.campus ?? null,
        classNumber: profile.classNumber ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await logAuthSecurity({
      ...context,
      eventName: "member_signup_code_request",
      status: "failure",
      actorType: "guest",
      properties: {
        reason: "exception",
        message: (error as Error).message,
      },
    });
    return NextResponse.json(
      { error: "request_failed", message: (error as Error).message },
      { status: 500 },
    );
  }
}
