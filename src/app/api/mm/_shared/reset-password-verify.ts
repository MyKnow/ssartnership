import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";
import { parseResetPasswordVerifyBody } from "./parsers";
import {
  createMemberAuthThrottleContext,
  getMemberAuthBlockedScope,
  getMemberAuthBlockedState,
  recordMemberAuthSuccess,
} from "./throttle";
import { mmOkResponse } from "./responses";
import {
  getLatestResetPasswordCode,
  isResetPasswordCodeExpired,
  isResetPasswordCodeValid,
} from "./reset-password-code-store";
import {
  failResetPasswordVerify,
  failResetPasswordVerifyException,
} from "./reset-password-verify-failure";
import { resolveResetPasswordMember } from "./reset-password-identity";

export const RESET_PASSWORD_VERIFY_RUNTIME = "nodejs";

export async function handleResetPasswordVerifyPost(request: Request) {
  const context = getRequestLogContext(request);

  try {
    const payload = await parseResetPasswordVerifyBody(request);
    const username = normalizeMmUsername(String(payload.username ?? ""));
    const code = String(payload.code ?? "").trim().toUpperCase();
    const throttleContext = createMemberAuthThrottleContext(
      context.ipAddress ?? null,
      username || null,
    );

    const blockedState = await getMemberAuthBlockedState(
      "verify-reset-code",
      throttleContext,
    );
    if (blockedState) {
      return failResetPasswordVerify({
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

    if (!username || !code) {
      return failResetPasswordVerify({
        context,
        throttleContext,
        error: "missing_fields",
        status: 400,
        reason: "missing_fields",
      });
    }

    if (validateMmUsername(username)) {
      return failResetPasswordVerify({
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
      return failResetPasswordVerify({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "team_or_channel_inaccessible",
        identifier: username,
        extra: {
          status: resolution.status,
        },
      });
    }

    if (resolution.kind === "not_registered") {
      return failResetPasswordVerify({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "not_registered",
        identifier: username,
      });
    }

    const codeRow = await getLatestResetPasswordCode(resolution.member.mm_user_id);
    if (!codeRow) {
      return failResetPasswordVerify({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "missing_code",
        identifier: resolution.member.mm_user_id,
      });
    }

    if (isResetPasswordCodeExpired(codeRow)) {
      return failResetPasswordVerify({
        context,
        throttleContext,
        error: "expired",
        status: 400,
        reason: "expired",
        identifier: resolution.member.mm_user_id,
      });
    }

    if (!isResetPasswordCodeValid(code, codeRow)) {
      return failResetPasswordVerify({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "invalid_code",
        identifier: resolution.member.mm_user_id,
      });
    }

    await logAuthSecurity({
      ...context,
      eventName: "member_password_reset_verify",
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
    await recordMemberAuthSuccess("verify-reset-code", throttleContext);

    return mmOkResponse({ ok: true, verified: true });
  } catch (error) {
    return failResetPasswordVerifyException({ context, error });
  }
}
