import {
  getRequestLogContext,
} from "@/lib/activity-logs";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";
import { parseResetPasswordBody } from "./parsers";
import {
  getMemberAuthBlockedScope,
  getMemberAuthBlockedState,
  createMemberAuthThrottleContext,
} from "./throttle";
import { executeResetPassword } from "./reset-password-execution";
import {
  failResetPassword,
  failResetPasswordException,
} from "./reset-password-failure";
import { resolveResetPasswordMember } from "./reset-password-identity";
import { mmOkResponse } from "./responses";

export const RESET_PASSWORD_RUNTIME = "nodejs";

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

    const resolution = await resolveResetPasswordMember(username);
    if (resolution.kind === "inaccessible") {
      return failResetPassword({
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
      return failResetPassword({
        context,
        throttleContext,
        error: "reset_failed",
        status: 400,
        reason: "not_registered",
        identifier: username,
      });
    }

    const result = await executeResetPassword({
      context,
      throttleContext,
      member: resolution.member,
      directoryEntry: resolution.directoryEntry,
      resolvedStudentYear: resolution.resolvedStudentYear,
    });

    if (result.kind === "failure") {
      return failResetPassword({
        context,
        throttleContext,
        error: result.error,
        status: result.status,
        reason: result.reason,
        identifier: result.identifier,
        actorType: result.actorType,
        actorId: result.actorId,
        blockedDelay: "blockedDelay" in result ? result.blockedDelay : undefined,
        message: "message" in result ? result.message : undefined,
        extra: result.extra,
      });
    }

    return mmOkResponse();
  } catch (error) {
    return failResetPasswordException({ context, error });
  }
}
