import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";
import { parseResetPasswordBody } from "./parsers";
import {
  createMemberAuthThrottleContext,
  getMemberAuthBlockedScope,
  getMemberAuthBlockedState,
  recordMemberAuthSuccess,
} from "./throttle";
import { mmOkResponse } from "./responses";
import {
  deliverResetPasswordCode,
  getResetPasswordCooldownState,
  isResetPasswordRequestBlocked,
  recordResetPasswordRequestAttempt,
} from "./reset-password-code-store";
import {
  failResetPasswordRequest,
  failResetPasswordRequestException,
} from "./reset-password-request-failure";
import { resolveResetPasswordMember } from "./reset-password-identity";

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
      "request-reset-code",
      throttleContext,
    );
    if (blockedState) {
      return failResetPasswordRequest({
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
      return failResetPasswordRequest({
        context,
        throttleContext,
        error: "missing_fields",
        status: 400,
        reason: "missing_fields",
      });
    }

    if (validateMmUsername(username)) {
      return failResetPasswordRequest({
        context,
        throttleContext,
        error: "invalid_username",
        status: 400,
        reason: "invalid_username",
        identifier: username,
      });
    }

    const resolution = await resolveResetPasswordMember(username);
    if (resolution.kind === "inaccessible") {
      return failResetPasswordRequest({
        context,
        throttleContext,
        error: "reset_failed",
        status: 400,
        reason: "team_or_channel_inaccessible",
        identifier: username,
        extra: {
          status: resolution.status,
        },
      });
    }

    if (resolution.kind === "not_registered") {
      return failResetPasswordRequest({
        context,
        throttleContext,
        error: "reset_failed",
        status: 400,
        reason: "not_registered",
        identifier: username,
      });
    }

    const resetBlocked = await isResetPasswordRequestBlocked(
      resolution.member.mm_user_id,
    );
    if (resetBlocked) {
      return failResetPasswordRequest({
        context,
        throttleContext,
        error: "blocked",
        status: 429,
        reason: "rate_limit",
        identifier: resolution.member.mm_user_id,
        recordFailure: false,
        blockedDelay: true,
        extra: {
          blockedUntil: resetBlocked.blockedUntil,
        },
      });
    }

    const cooldownState = await getResetPasswordCooldownState(
      resolution.member.mm_user_id,
    );
    if (cooldownState.inCooldown) {
      return failResetPasswordRequest({
        context,
        throttleContext,
        error: "cooldown",
        status: 429,
        reason: "cooldown",
        identifier: resolution.member.mm_user_id,
      });
    }

    await deliverResetPasswordCode({
      member: resolution.member,
      directorySourceYears: resolution.directoryEntry?.source_years ?? [],
      senderYearFallbacks: [resolution.resolvedStudentYear, 15, 14],
    });
    await recordResetPasswordRequestAttempt(resolution.member.mm_user_id);

    await logAuthSecurity({
      ...context,
      eventName: "member_password_reset_request",
      status: "success",
      actorType: "guest",
      identifier: username,
      properties: {
        mmUserId: resolution.member.mm_user_id,
        mmUsername: resolution.member.mm_username,
        year: resolution.member.year,
        campus: resolution.member.campus ?? null,
      },
    });
    await recordMemberAuthSuccess("request-reset-code", throttleContext);

    return mmOkResponse();
  } catch (error) {
    return failResetPasswordRequestException({ context, error });
  }
}
