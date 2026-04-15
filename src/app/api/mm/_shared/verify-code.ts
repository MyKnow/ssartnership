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
import { hashCode } from "@/lib/mm-verification";
import {
  getSelectedPolicyValidationError,
  getActiveRequiredPolicies,
  recordRequiredPolicyConsent,
} from "@/lib/policy-documents";
import { hashPassword, isValidPassword } from "@/lib/password";
import { setUserSession } from "@/lib/user-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getEffectiveSsafyYear,
  getPreferredStaffSourceYear,
} from "@/lib/ssafy-year";
import { getUserImage, resolveSelectableMemberByUsername } from "@/lib/mattermost";
import {
  normalizeMmUsername,
  PASSWORD_POLICY_MESSAGE,
  validateMmUsername,
} from "@/lib/validation";
import { parseVerifyCodeBody } from "./parsers";
import {
  getMemberAuthBlockedScope,
  getMemberAuthBlockedState,
  createMemberAuthThrottleContext,
  delayMemberAuthFailure,
  recordMemberAuthFailure,
  recordMemberAuthSuccess,
} from "./throttle";
import { isMattermostApiError, loginAsSsafySender, upsertDirectorySnapshotFromMmUser } from "./mattermost";
import { mmErrorResponse, mmOkResponse } from "./responses";
import type { MemberAuthThrottleContext, MmRouteContext } from "./types";

export const VERIFY_CODE_RUNTIME = "nodejs";

const MAX_FAILS = 5;
const BLOCK_MINUTES = 60;

async function failVerifyCode({
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
    eventName: "member_signup_complete",
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
    await recordMemberAuthFailure("verify-code", throttleContext, blockedDelay);
  } else {
    await delayMemberAuthFailure("verify-code", blockedDelay);
  }

  return mmErrorResponse(error, status, message);
}

export async function handleVerifyCodePost(request: Request) {
  const context = getRequestLogContext(request);

  try {
    const payload = await parseVerifyCodeBody(request);
    const username = normalizeMmUsername(String(payload.username ?? ""));
    const code = String(payload.code ?? "").trim().toUpperCase();
    const password = String(payload.password ?? "").trim();
    const throttleContext = createMemberAuthThrottleContext(
      context.ipAddress ?? null,
      username || null,
    );

    const blockedState = await getMemberAuthBlockedState(
      "verify-code",
      throttleContext,
    );
    if (blockedState) {
      return failVerifyCode({
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

    if (!username || !code || !password) {
      return failVerifyCode({
        context,
        throttleContext,
        error: "missing_fields",
        status: 400,
        reason: "missing_fields",
        identifier: username || null,
      });
    }

    if (validateMmUsername(username)) {
      return failVerifyCode({
        context,
        throttleContext,
        error: "invalid_username",
        status: 400,
        reason: "invalid_username",
        identifier: username,
      });
    }

    if (!isValidPassword(password)) {
      return failVerifyCode({
        context,
        throttleContext,
        error: "invalid_password",
        status: 400,
        reason: "invalid_password",
        identifier: username,
        message: PASSWORD_POLICY_MESSAGE,
      });
    }

    if (!payload.servicePolicyId || !payload.privacyPolicyId) {
      return failVerifyCode({
        context,
        throttleContext,
        error: "policy_required",
        status: 400,
        reason: "policy_required",
        identifier: username,
      });
    }

    const activePolicies = await getActiveRequiredPolicies();
    const policyValidationError = getSelectedPolicyValidationError(
      {
        servicePolicyId: payload.servicePolicyId,
        privacyPolicyId: payload.privacyPolicyId,
      },
      activePolicies,
    );
    if (policyValidationError) {
      await logAuthSecurity({
        ...context,
        eventName: "member_signup_complete",
        status: "failure",
        actorType: "guest",
        identifier: username,
        properties: { reason: "policy_outdated" },
      });
      return mmErrorResponse("policy_outdated", 409, policyValidationError);
    }

    const supabase = getSupabaseAdminClient();
    let resolvedStudent:
      | {
          year: number;
          token: string;
          user: {
            id: string;
            username: string;
            nickname?: string;
            first_name?: string;
            last_name?: string;
            is_bot?: boolean;
          };
        }
      | null = null;
    const directoryEntry = await findMmUserDirectoryEntryByUsername(username);
    let mmUserId = directoryEntry?.mm_user_id ?? null;
    let resolvedDisplayName = directoryEntry?.display_name ?? null;
    let resolvedCampus = directoryEntry?.campus ?? null;

    if (!mmUserId) {
      try {
        const resolved = await resolveSelectableMemberByUsername(username);
        if (resolved) {
          resolvedStudent = {
            year: resolved.year,
            token: "",
            user: resolved.user,
          };
          const summary = await upsertDirectorySnapshotFromMmUser(
            resolved.user,
            [resolved.year],
          );
          resolvedDisplayName = summary.displayName;
          resolvedCampus = summary.campus;
          mmUserId = resolved.user.id;
        }
      } catch (error) {
        if (isMattermostApiError(error)) {
          return failVerifyCode({
            context,
            throttleContext,
            error: "invalid_code",
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

      if (!mmUserId) {
        return failVerifyCode({
          context,
          throttleContext,
          error: "invalid_code",
          status: 400,
          reason: "not_mm",
          identifier: username,
        });
      }
    }

    const { data: attempt } = await supabase
      .from("mm_verification_attempts")
      .select("id,count,blocked_until,first_attempt_at")
      .eq("identifier", mmUserId)
      .maybeSingle();

    if (attempt?.blocked_until) {
      const blockedUntil = new Date(attempt.blocked_until);
      if (blockedUntil > new Date()) {
        return failVerifyCode({
          context,
          throttleContext,
          error: "blocked",
          status: 429,
          reason: "verification_blocked",
          identifier: mmUserId,
          blockedDelay: true,
        });
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
      return failVerifyCode({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "missing_code",
        identifier: mmUserId,
      });
    }

    if (new Date(codeRow.expires_at) < new Date()) {
      return failVerifyCode({
        context,
        throttleContext,
        error: "expired",
        status: 400,
        reason: "expired",
        identifier: mmUserId,
      });
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

      return failVerifyCode({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "invalid_code",
        identifier: mmUserId,
        blockedDelay: Boolean(blockedUntil),
        extra: {
          attemptCount: nextCount,
        },
      });
    }

    const { data: memberData } = await supabase
      .from("members")
      .select(
        "id,mm_user_id,mm_username,display_name,year,campus,avatar_content_type,avatar_base64,updated_at",
      )
      .eq("mm_user_id", mmUserId)
      .maybeSingle();
    const member = (memberData as MemberRow | null) ?? null;
    const passwordRecord = hashPassword(password);
    const preferredStaffSourceYear = getPreferredStaffSourceYear(
      directoryEntry?.source_years ?? [],
    );
    const senderYear =
      codeRow.year === 0
        ? getEffectiveSsafyYear(
            member?.year ?? 0,
            null,
            [resolvedStudent?.year, preferredStaffSourceYear, 15, 14],
          )
        : codeRow.year;
    if (senderYear === null) {
      return mmErrorResponse(
        "verify_failed",
        503,
        "운영진 회원 정보를 확인하지 못했습니다. 다시 시도해 주세요.",
      );
    }

    const senderLogin = await loginAsSsafySender(senderYear);
    const avatar = await getUserImage(senderLogin.token, mmUserId);
    const snapshot = {
      mmUserId,
      mmUsername:
        directoryEntry?.mm_username ?? resolvedStudent?.user.username ?? mmUserId,
      displayName: resolvedDisplayName ?? member?.display_name ?? mmUserId,
      campus: resolvedCampus ?? member?.campus ?? null,
      avatarFetched: Boolean(avatar),
      avatarContentType: avatar?.contentType ?? null,
      avatarBase64: avatar?.base64 ?? null,
    };

    const nextYear = codeRow.year ?? member?.year ?? null;
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
          year: nextYear ?? codeRow.year,
          campus: nextMember.campus ?? null,
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
    } else {
      const { data: inserted } = await supabase
        .from("members")
        .insert({
          mm_user_id: mmUserId,
          mm_username: snapshot.mmUsername,
          display_name: snapshot.displayName,
          year: nextYear ?? codeRow.year,
          campus: snapshot.campus,
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
      }
    }

    if (!authenticatedMemberId) {
      return mmErrorResponse(
        "verify_failed",
        503,
        "회원 생성을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }

    await recordRequiredPolicyConsent({
      memberId: authenticatedMemberId,
      activePolicies,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });
    await setUserSession(authenticatedMemberId, false);

    await supabase
      .from("mm_verification_attempts")
      .delete()
      .eq("identifier", mmUserId);
    await supabase
      .from("mm_verification_codes")
      .delete()
      .eq("mm_user_id", mmUserId);
    await recordMemberAuthSuccess("verify-code", throttleContext);

    await logAuthSecurity({
      ...context,
      eventName: "member_signup_complete",
      status: "success",
      actorType: "member",
      actorId: authenticatedMemberId,
      identifier: mmUserId,
      properties: {
        year: nextYear ?? codeRow.year ?? null,
        campus: nextMember?.campus ?? snapshot.campus,
        existingMember: Boolean(member?.id),
        mmUsername: snapshot.mmUsername,
        mmUserId,
      },
    });

    return mmOkResponse();
  } catch (error) {
    const context = getRequestLogContext(request);
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
    await delayMemberAuthFailure("verify-code", true);

    return mmErrorResponse(
      "verify_failed",
      503,
      "인증 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}
