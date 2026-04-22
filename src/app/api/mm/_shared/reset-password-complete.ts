import { revalidatePath } from "next/cache";
import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import { hashPassword, isValidPassword } from "@/lib/password";
import { PASSWORD_POLICY_MESSAGE } from "@/lib/validation";
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
} from "./reset-password-code-store";
import {
  failResetPasswordComplete,
  failResetPasswordCompleteException,
} from "./reset-password-complete-failure";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { verifyResetPasswordCompletionToken } from "@/lib/reset-password-session";

export const RESET_PASSWORD_COMPLETE_RUNTIME = "nodejs";

export async function handleResetPasswordCompletePost(request: Request) {
  const context = getRequestLogContext(request);

  try {
    const payload = await parseResetPasswordCompleteBody(request);
    const token = String(payload.token ?? "").trim();
    const nextPassword = String(payload.nextPassword ?? "");
    const nextPasswordConfirm = String(payload.nextPasswordConfirm ?? "");
    let throttleContext = createMemberAuthThrottleContext(
      context.ipAddress ?? null,
      token || null,
    );

    if (!token || !nextPassword || !nextPasswordConfirm) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "missing_fields",
        status: 400,
        reason: "missing_fields",
      });
    }

    const tokenPayload = verifyResetPasswordCompletionToken(token);
    if (!tokenPayload) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "invalid_code",
        identifier: null,
      });
    }

    throttleContext = createMemberAuthThrottleContext(
      context.ipAddress ?? null,
      tokenPayload.mmUserId,
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
        identifier: tokenPayload.mmUserId,
        recordFailure: false,
        blockedDelay: true,
        extra: {
          scope: getMemberAuthBlockedScope(blockedState.identifier),
          blockedUntil: blockedState.blockedUntil,
        },
      });
    }

    if (nextPassword !== nextPasswordConfirm) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "password_mismatch",
        status: 400,
        reason: "password_mismatch",
        identifier: tokenPayload.mmUserId,
      });
    }

    if (!isValidPassword(nextPassword)) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "invalid_password",
        status: 400,
        reason: "invalid_password",
        identifier: tokenPayload.mmUserId,
        message: PASSWORD_POLICY_MESSAGE,
      });
    }

    const codeRow = await getLatestResetPasswordCode(tokenPayload.mmUserId);
    if (!codeRow) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "missing_code",
        identifier: tokenPayload.mmUserId,
      });
    }

    if (codeRow.id !== tokenPayload.codeId) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "stale_code",
        identifier: tokenPayload.mmUserId,
      });
    }

    const { data: memberRow, error: memberFetchError } = await getSupabaseAdminClient()
      .from("members")
      .select("id,mm_user_id,mm_username,year,campus")
      .eq("mm_user_id", tokenPayload.mmUserId)
      .maybeSingle();
    if (memberFetchError || !memberRow) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "reset_failed",
        status: 400,
        reason: "not_registered",
        identifier: tokenPayload.mmUserId,
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
      .eq("id", memberRow.id);
    if (error) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "reset_failed",
        status: 400,
        reason: "db_error",
        identifier: tokenPayload.mmUserId,
      });
    }

    await clearExistingResetPasswordCodeState(tokenPayload.mmUserId);
    const { error: resetAttemptDeleteError } = await supabase
      .from("password_reset_attempts")
      .delete()
      .eq("identifier", tokenPayload.mmUserId);
    if (resetAttemptDeleteError) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "reset_failed",
        status: 400,
        reason: "db_error",
        identifier: tokenPayload.mmUserId,
      });
    }

    await logAuthSecurity({
      ...context,
      eventName: "member_password_reset_complete",
      status: "success",
      actorType: "member",
      actorId: memberRow.id,
      identifier: tokenPayload.mmUserId,
      properties: {
        mmUserId: memberRow.mm_user_id,
        mmUsername: memberRow.mm_username,
        year: memberRow.year,
        campus: memberRow.campus ?? null,
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
