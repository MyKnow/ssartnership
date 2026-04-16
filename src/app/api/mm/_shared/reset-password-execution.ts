import {
  logAdminAudit,
  logAuthSecurity,
} from "@/lib/activity-logs";
import {
  buildMemberSyncLogProperties,
  type MemberRow,
  syncMemberSnapshot,
} from "@/lib/mm-member-sync";
import {
  createDirectChannel,
  findUserInChannelByUserId,
  getStudentChannelConfig,
  getUserImage,
  sendPost,
} from "@/lib/mattermost";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getEffectiveSsafyYear,
  getPreferredStaffSourceYear,
} from "@/lib/ssafy-year";
import { recordMemberAuthSuccess } from "./throttle";
import {
  getMattermostProfileSummary,
  isMattermostApiError,
  loginAsSsafySender,
} from "./mattermost";
import type { MemberAuthThrottleContext, MmRouteContext } from "./types";

const MAX_FAILS = 5;
const BLOCK_MINUTES = 60;
const RESEND_COOLDOWN_SECONDS = 60;

type DirectoryEntry = Awaited<
  ReturnType<typeof import("@/lib/mm-directory").findMmUserDirectoryEntryByUsername>
>;

export type ResetPasswordExecutionFailure =
  | {
      kind: "failure";
      error: "reset_failed" | "blocked" | "cooldown";
      status: 400 | 429;
      reason:
        | "team_or_channel_inaccessible"
        | "not_mm"
        | "cooldown"
        | "rate_limit";
      identifier: string;
      actorType?: "guest" | "member";
      actorId?: string;
      blockedDelay?: boolean;
      extra?: Record<string, unknown>;
    }
  | {
      kind: "failure";
      error: "reset_failed";
      status: 503;
      reason: "sender_unavailable";
      identifier: string;
      actorType?: "guest" | "member";
      actorId?: string;
      message: string;
      extra?: Record<string, unknown>;
    };

export type ResetPasswordExecutionResult =
  | { kind: "success" }
  | ResetPasswordExecutionFailure;

export async function executeResetPassword(input: {
  context: MmRouteContext;
  throttleContext: MemberAuthThrottleContext;
  member: MemberRow;
  directoryEntry: DirectoryEntry;
  resolvedStudentYear: number | null;
}): Promise<ResetPasswordExecutionResult> {
  const { context, throttleContext, directoryEntry, resolvedStudentYear } = input;
  let member = input.member;
  const supabase = getSupabaseAdminClient();

  const preferredStaffSourceYear = getPreferredStaffSourceYear(
    directoryEntry?.source_years ?? [],
  );
  const effectiveYear = getEffectiveSsafyYear(
    member.year,
    null,
    [resolvedStudentYear, preferredStaffSourceYear, 15, 14],
  );
  if (effectiveYear === null) {
    return {
      kind: "failure",
      error: "reset_failed",
      status: 503,
      reason: "sender_unavailable",
      identifier: member.mm_user_id,
      actorType: "member",
      actorId: member.id,
      message: "운영진 회원 정보를 확인하지 못했습니다. 다시 시도해 주세요.",
    } satisfies ResetPasswordExecutionFailure;
  }

  const senderLogin = await loginAsSsafySender(effectiveYear);
  const channelConfig = getStudentChannelConfig(effectiveYear);
  let mmUser;
  try {
    mmUser = await findUserInChannelByUserId(
      senderLogin.token,
      member.mm_user_id,
      channelConfig,
    );
  } catch (error) {
    if (isMattermostApiError(error)) {
      return {
        kind: "failure",
        error: "reset_failed",
        status: 400,
        reason: "team_or_channel_inaccessible",
        identifier: member.mm_user_id,
        actorType: "member",
        actorId: member.id,
        extra: {
          status: error.status,
        },
      } satisfies ResetPasswordExecutionFailure;
    }
    throw error;
  }

  if (!mmUser) {
    return {
      kind: "failure",
      error: "reset_failed",
      status: 400,
      reason: "not_mm",
      identifier: member.mm_user_id,
      actorType: "member",
      actorId: member.id,
    } satisfies ResetPasswordExecutionFailure;
  }

  const { data: attempt } = await supabase
    .from("password_reset_attempts")
    .select("id,count,blocked_until,first_attempt_at,created_at")
    .eq("identifier", member.mm_user_id)
    .maybeSingle();

  if (attempt?.blocked_until) {
    const blockedUntil = new Date(attempt.blocked_until);
    if (blockedUntil > new Date()) {
      return {
        kind: "failure",
        error: "blocked",
        status: 429,
        reason: "rate_limit",
        identifier: member.mm_user_id,
        actorType: "member",
        actorId: member.id,
        blockedDelay: true,
      } satisfies ResetPasswordExecutionFailure;
    }
  }

  if (attempt?.created_at) {
    const createdAt = new Date(attempt.created_at);
    const diffSeconds = (Date.now() - createdAt.getTime()) / 1000;
    if (diffSeconds < RESEND_COOLDOWN_SECONDS) {
      return {
        kind: "failure",
        error: "cooldown",
        status: 429,
        reason: "cooldown",
        identifier: member.mm_user_id,
        actorType: "member",
        actorId: member.id,
      } satisfies ResetPasswordExecutionFailure;
    }
  }

  const avatar = await getUserImage(senderLogin.token, member.mm_user_id);
  const profile = getMattermostProfileSummary(mmUser);
  const syncResult = await syncMemberSnapshot(member, {
    mmUserId: member.mm_user_id,
    mmUsername: mmUser.username,
    displayName: profile.displayName,
    campus: profile.campus,
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
    senderLogin.user.id,
    mmUser.id,
  );
  await sendPost(
    senderLogin.token,
    dmChannel.id,
    [
      "SSARTNERSHIP 임시 비밀번호입니다.",
      "",
      "임시 비밀번호",
      "```plaintext",
      tempPassword,
      "```",
      "보안을 위해 로그인 후 반드시 변경해 주세요.",
    ].join("\n"),
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
  await recordMemberAuthSuccess("reset-password", throttleContext);

  return { kind: "success" };
}
