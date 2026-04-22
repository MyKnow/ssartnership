import { revalidatePath } from "next/cache";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { hashPassword, isValidPassword } from "@/lib/password";
import { normalizeMmUsername, PASSWORD_POLICY_MESSAGE, validateMmUsername } from "@/lib/validation";
import { parseResetPasswordCompleteBody } from "./parsers";
import {
  createMemberAuthThrottleContext,
  getMemberAuthBlockedScope,
  getMemberAuthBlockedState,
  recordMemberAuthSuccess,
} from "./throttle";
import { mmOkResponse } from "./responses";
import {
  clearExistingResetPasswordCodeState,
  getLatestResetPasswordCode,
  isResetPasswordCodeExpired,
  isResetPasswordCodeValid,
} from "./reset-password-code-store";
import {
  failResetPasswordComplete,
  failResetPasswordCompleteException,
} from "./reset-password-complete-failure";
import { resolveResetPasswordMember } from "./reset-password-identity";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const RESET_PASSWORD_COMPLETE_RUNTIME = "nodejs";

export async function handleResetPasswordCompletePost(request: Request) {
  const context = getRequestLogContext(request);

  try {
    const payload = await parseResetPasswordCompleteBody(request);
    const username = normalizeMmUsername(String(payload.username ?? ""));
    const code = String(payload.code ?? "").trim().toUpperCase();
    const nextPassword = String(payload.nextPassword ?? "");
    const nextPasswordConfirm = String(payload.nextPasswordConfirm ?? "");
    const throttleContext = createMemberAuthThrottleContext(
      context.ipAddress ?? null,
      username || null,
    );

    const blockedState = await getMemberAuthBlockedState(
      "reset-password",
      throttleContext,
    );
    if (blockedState) {
      return failResetPasswordComplete({
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

    if (!username || !code || !nextPassword || !nextPasswordConfirm) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "missing_fields",
        status: 400,
        reason: "missing_fields",
      });
    }

    if (validateMmUsername(username)) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "invalid_username",
        status: 400,
        reason: "invalid_username",
        identifier: username,
      });
    }

    if (nextPassword !== nextPasswordConfirm) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "password_mismatch",
        status: 400,
        reason: "password_mismatch",
        identifier: username,
      });
    }

    if (!isValidPassword(nextPassword)) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "invalid_password",
        status: 400,
        reason: "invalid_password",
        identifier: username,
        message: PASSWORD_POLICY_MESSAGE,
      });
    }

    const resolution = await resolveResetPasswordMember(username);
    if (resolution.kind === "inaccessible") {
      return failResetPasswordComplete({
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
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "reset_failed",
        status: 400,
        reason: "not_registered",
        identifier: username,
      });
    }

    const codeRow = await getLatestResetPasswordCode(resolution.member.mm_user_id);
    if (!codeRow) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "missing_code",
        identifier: resolution.member.mm_user_id,
      });
    }

    if (isResetPasswordCodeExpired(codeRow)) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "expired",
        status: 400,
        reason: "expired",
        identifier: resolution.member.mm_user_id,
      });
    }

    if (!isResetPasswordCodeValid(code, codeRow)) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "invalid_code",
        identifier: resolution.member.mm_user_id,
      });
    }

    const passwordRecord = hashPassword(nextPassword);
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("members")
      .update({
        password_hash: passwordRecord.hash,
        password_salt: passwordRecord.salt,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resolution.member.id);
    if (error) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "reset_failed",
        status: 400,
        reason: "db_error",
        identifier: resolution.member.mm_user_id,
      });
    }

    await clearExistingResetPasswordCodeState(resolution.member.mm_user_id);
    const { error: resetAttemptDeleteError } = await supabase
      .from("password_reset_attempts")
      .delete()
      .eq("identifier", resolution.member.mm_user_id);
    if (resetAttemptDeleteError) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "reset_failed",
        status: 400,
        reason: "db_error",
        identifier: resolution.member.mm_user_id,
      });
    }

    await logAuthSecurity({
      ...context,
      eventName: "member_password_reset_complete",
      status: "success",
      actorType: "member",
      actorId: resolution.member.id,
      identifier: resolution.member.mm_user_id,
      properties: {
        mmUserId: resolution.member.mm_user_id,
        mmUsername: resolution.member.mm_username,
        year: resolution.member.year,
        campus: resolution.member.campus ?? null,
      },
    });
    await recordMemberAuthSuccess("reset-password", throttleContext);

    revalidatePath("/auth/login");
    revalidatePath("/auth/reset");
    revalidatePath("/auth/change-password");

    return mmOkResponse();
  } catch (error) {
    return failResetPasswordCompleteException({ context, error });
  }
}
