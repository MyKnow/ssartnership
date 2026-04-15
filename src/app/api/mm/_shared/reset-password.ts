import {
  getRequestLogContext,
  logAdminAudit,
  logAuthSecurity,
} from "@/lib/activity-logs";
import {
  buildMemberSyncLogProperties,
  type MemberRow,
  syncMemberSnapshot,
} from "@/lib/mm-member-sync";
import {
  findMmUserDirectoryEntryByUsername,
} from "@/lib/mm-directory";
import {
  createDirectChannel,
  findUserInChannelByUserId,
  getStudentChannelConfig,
  getUserImage,
  resolveSelectableMemberByUsername,
  sendPost,
} from "@/lib/mattermost";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getEffectiveSsafyYear,
  getPreferredStaffSourceYear,
} from "@/lib/ssafy-year";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";
import { parseResetPasswordBody } from "./parsers";
import {
  getMemberAuthBlockedScope,
  getMemberAuthBlockedState,
  createMemberAuthThrottleContext,
  delayMemberAuthFailure,
  recordMemberAuthFailure,
  recordMemberAuthSuccess,
} from "./throttle";
import { getMattermostProfileSummary, isMattermostApiError, loginAsSsafySender, upsertDirectorySnapshotFromMmUser } from "./mattermost";
import { mmErrorResponse, mmOkResponse } from "./responses";
import type { MemberAuthThrottleContext, MmRouteContext } from "./types";

export const RESET_PASSWORD_RUNTIME = "nodejs";

const MAX_FAILS = 5;
const BLOCK_MINUTES = 60;
const RESEND_COOLDOWN_SECONDS = 60;

async function failResetPassword({
  context,
  throttleContext,
  error,
  status,
  reason,
  identifier,
  actorType = "guest",
  actorId,
  recordFailure = true,
  blockedDelay = false,
  message,
  extra = {},
}: {
  context: MmRouteContext;
  throttleContext: MemberAuthThrottleContext;
  error: string;
  status: number;
  reason: string;
  identifier?: string | null;
  actorType?: "guest" | "member";
  actorId?: string;
  recordFailure?: boolean;
  blockedDelay?: boolean;
  message?: string;
  extra?: Record<string, unknown>;
}) {
  await logAuthSecurity({
    ...context,
    eventName: "member_password_reset",
    status: blockedDelay ? "blocked" : "failure",
    actorType,
    actorId,
    identifier: identifier ?? null,
    properties: {
      reason,
      ...extra,
    },
  });

  if (recordFailure) {
    await recordMemberAuthFailure("reset-password", throttleContext, blockedDelay);
  } else {
    await delayMemberAuthFailure("reset-password", blockedDelay);
  }

  return mmErrorResponse(error, status, message);
}

export async function handleResetPasswordPost(request: Request) {
  const context = getRequestLogContext(request);

  try {
    const payload = await parseResetPasswordBody(request);
    const username = normalizeMmUsername(String(payload.username ?? ""));
    const throttleContext = createMemberAuthThrottleContext(
      context.ipAddress ?? null,
      username || null,
    );

    const blockedState = await getMemberAuthBlockedState(
      "reset-password",
      throttleContext,
    );
    if (blockedState) {
      return failResetPassword({
        context,
        throttleContext,
        error: "blocked",
        status: 429,
        reason: "rate_limit",
        identifier: username || null,
        recordFailure: false,
        blockedDelay: true,
        extra: {
          scope: getMemberAuthBlockedScope(blockedState.identifier),
          blockedUntil: blockedState.blockedUntil,
        },
      });
    }

    if (!username) {
      return failResetPassword({
        context,
        throttleContext,
        error: "missing_fields",
        status: 400,
        reason: "missing_fields",
      });
    }

    if (validateMmUsername(username)) {
      return failResetPassword({
        context,
        throttleContext,
        error: "invalid_username",
        status: 400,
        reason: "invalid_username",
        identifier: username,
      });
    }

    const supabase = getSupabaseAdminClient();
    const memberSelect =
      "id,mm_user_id,mm_username,display_name,year,campus,avatar_content_type,avatar_base64,updated_at";
    const directoryEntry = await findMmUserDirectoryEntryByUsername(username);
    let resolvedStudentYear: number | null = null;
    let member: MemberRow | null = null;

    if (directoryEntry?.mm_user_id) {
      const { data: memberById } = await supabase
        .from("members")
        .select(memberSelect)
        .eq("mm_user_id", directoryEntry.mm_user_id)
        .maybeSingle();
      member = (memberById as MemberRow | null) ?? null;
    } else {
      try {
        const resolved = await resolveSelectableMemberByUsername(username);
        if (resolved) {
          resolvedStudentYear = resolved.year;
          await upsertDirectorySnapshotFromMmUser(resolved.user, [resolved.year]);
          const { data: memberById } = await supabase
            .from("members")
            .select(memberSelect)
            .eq("mm_user_id", resolved.user.id)
            .maybeSingle();
          member = (memberById as MemberRow | null) ?? null;
        }
      } catch (error) {
        if (isMattermostApiError(error)) {
          return failResetPassword({
            context,
            throttleContext,
            error: "reset_failed",
            status: 400,
            reason: "team_or_channel_inaccessible",
            identifier: username,
            extra: {
              status: error.status,
            },
          });
        }
        throw error;
      }
    }

    if (!member?.id) {
      return failResetPassword({
        context,
        throttleContext,
        error: "reset_failed",
        status: 400,
        reason: "not_registered",
        identifier: username,
      });
    }

    const preferredStaffSourceYear = getPreferredStaffSourceYear(
      directoryEntry?.source_years ?? [],
    );
    const effectiveYear = getEffectiveSsafyYear(
      member.year,
      null,
      [resolvedStudentYear, preferredStaffSourceYear, 15, 14],
    );
    if (effectiveYear === null) {
      return mmErrorResponse(
        "reset_failed",
        503,
        "운영진 회원 정보를 확인하지 못했습니다. 다시 시도해 주세요.",
      );
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
        return failResetPassword({
          context,
          throttleContext,
          error: "reset_failed",
          status: 400,
          reason: "team_or_channel_inaccessible",
          identifier: member.mm_user_id,
          extra: {
            status: error.status,
          },
        });
      }
      throw error;
    }

    if (!mmUser) {
      return failResetPassword({
        context,
        throttleContext,
        error: "reset_failed",
        status: 400,
        reason: "not_mm",
        identifier: member.mm_user_id,
        actorType: "member",
        actorId: member.id,
      });
    }

    const { data: attempt } = await supabase
      .from("password_reset_attempts")
      .select("id,count,blocked_until,first_attempt_at,created_at")
      .eq("identifier", member.mm_user_id)
      .maybeSingle();

    if (attempt?.blocked_until) {
      const blockedUntil = new Date(attempt.blocked_until);
      if (blockedUntil > new Date()) {
        return failResetPassword({
          context,
          throttleContext,
          error: "blocked",
          status: 429,
          reason: "rate_limit",
          identifier: member.mm_user_id,
          actorType: "member",
          actorId: member.id,
          blockedDelay: true,
        });
      }
    }

    if (attempt?.created_at) {
      const createdAt = new Date(attempt.created_at);
      const diffSeconds = (Date.now() - createdAt.getTime()) / 1000;
      if (diffSeconds < RESEND_COOLDOWN_SECONDS) {
        return failResetPassword({
          context,
          throttleContext,
          error: "cooldown",
          status: 429,
          reason: "cooldown",
          identifier: member.mm_user_id,
          actorType: "member",
          actorId: member.id,
        });
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

    return mmOkResponse();
  } catch (error) {
    const context = getRequestLogContext(request);
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
    await delayMemberAuthFailure("reset-password", true);

    return mmErrorResponse(
      "reset_failed",
      503,
      "비밀번호 재설정에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}

