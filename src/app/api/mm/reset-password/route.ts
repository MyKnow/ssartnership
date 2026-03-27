import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { generateTempPassword, hashPassword } from "@/lib/password";
import {
  getSenderCredentials,
  getMe,
  findUserInChannelByUsername,
  loginWithPassword,
  createDirectChannel,
  sendPost,
} from "@/lib/mattermost";

export const runtime = "nodejs";

const MAX_FAILS = 5;
const BLOCK_MINUTES = 60;
const RESEND_COOLDOWN_SECONDS = 60;

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { username?: string };
    const username = String(payload.username ?? "").trim().replace(/^@/, "");
    if (!username) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: attempt } = await supabase
      .from("password_reset_attempts")
      .select("id,count,blocked_until,first_attempt_at,created_at")
      .eq("identifier", username)
      .maybeSingle();

    if (attempt?.blocked_until) {
      const blockedUntil = new Date(attempt.blocked_until);
      if (blockedUntil > new Date()) {
        return NextResponse.json({ error: "blocked" }, { status: 429 });
      }
    }

    if (attempt?.created_at) {
      const createdAt = new Date(attempt.created_at);
      const diffSeconds = (Date.now() - createdAt.getTime()) / 1000;
      if (diffSeconds < RESEND_COOLDOWN_SECONDS) {
        return NextResponse.json({ error: "cooldown" }, { status: 429 });
      }
    }

    const { data: member } = await supabase
      .from("members")
      .select("id,mm_username")
      .eq("mm_username", username)
      .maybeSingle();

    if (!member?.id) {
      return NextResponse.json({ error: "not_registered" }, { status: 404 });
    }

    const senderCredentials = getSenderCredentials();
    const senderLogin = await loginWithPassword(
      senderCredentials.loginId,
      senderCredentials.password,
    );
    const sender = await getMe(senderLogin.token);
    const teamName = process.env.MM_TEAM_NAME ?? "s15public";
    const channelName = process.env.MM_STUDENT_CHANNEL ?? "off-topic";
    const mmUser = await findUserInChannelByUsername(
      senderLogin.token,
      teamName,
      channelName,
      username,
    );
    if (!mmUser) {
      return NextResponse.json({ error: "not_mm" }, { status: 404 });
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
        identifier: username,
        count: nextCount,
        blocked_until: blockedUntil,
        first_attempt_at: firstAttemptAt,
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "reset_failed", message: (error as Error).message },
      { status: 500 },
    );
  }
}
