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
  failResetPasswordComplete,
  failResetPasswordCompleteException,
} from "./reset-password-complete-failure";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  extractResetPasswordCompletionTokenFromCookieHeader,
  getResetPasswordCompletionCookieOptions,
  RESET_PASSWORD_COMPLETION_COOKIE_NAME,
  verifyResetPasswordCompletionToken,
} from "@/lib/reset-password-session";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";

export async function handleResetPasswordCompletePost(request: Request) {
  const context = getRequestLogContext(request);
  let throttleContext = createMemberAuthThrottleContext(
    context.ipAddress ?? null,
    null,
  );

  try {
    if (
      !isTrustedSameOriginRequest(request, {
        allowedContentTypes: ["application/json"],
      })
    ) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "invalid_request",
        status: 403,
        reason: "same_origin_failed",
        recordFailure: false,
        blockedDelay: true,
      });
    }

    const payload = await parseResetPasswordCompleteBody(request);
    const token = extractResetPasswordCompletionTokenFromCookieHeader(
      request.headers.get("cookie"),
    );
    const nextPassword = String(payload.nextPassword ?? "");
    const nextPasswordConfirm = String(payload.nextPasswordConfirm ?? "");

    if (!token) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "missing_token",
        identifier: null,
      });
    }

    if (!nextPassword || !nextPasswordConfirm) {
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

    const supabase = getSupabaseAdminClient();
    const { data: directoryEntry, error: directoryFetchError } = await supabase
      .from("mm_user_directory")
      .select("id,mm_user_id,mm_username")
      .eq("mm_user_id", tokenPayload.mmUserId)
      .eq("is_active", true)
      .maybeSingle();
    if (directoryFetchError || !directoryEntry?.id) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "reset_failed",
        status: 400,
        reason: "not_registered",
        identifier: tokenPayload.mmUserId,
      });
    }

    const { data: memberRow, error: memberFetchError } = await supabase
      .from("members")
      .select("id,generation,campus,updated_at")
      .eq("id", tokenPayload.memberId)
      .eq("mattermost_account_id", directoryEntry.id)
      .is("deleted_at", null)
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

    const memberUpdatedAt = new Date(memberRow.updated_at).getTime();
    const tokenUpdatedAt = new Date(tokenPayload.memberUpdatedAt).getTime();
    if (
      !Number.isFinite(memberUpdatedAt) ||
      !Number.isFinite(tokenUpdatedAt) ||
      memberUpdatedAt !== tokenUpdatedAt
    ) {
      return failResetPasswordComplete({
        context,
        throttleContext,
        error: "invalid_code",
        status: 400,
        reason: "stale_token",
        identifier: tokenPayload.mmUserId,
      });
    }

    const passwordRecord = hashPassword(nextPassword);
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
        mmUserId: directoryEntry.mm_user_id,
        mmUsername: directoryEntry.mm_username,
        generation: memberRow.generation,
        campus: memberRow.campus ?? null,
      },
    });
    await recordMemberAuthSuccess("reset-password", throttleContext);

    revalidatePath("/auth/login");
    revalidatePath("/auth/reset");
    revalidatePath("/auth/change-password");

    const response = mmOkResponse();
    response.cookies.set(
      RESET_PASSWORD_COMPLETION_COOKIE_NAME,
      "",
      getResetPasswordCompletionCookieOptions(0),
    );
    return response;
  } catch (error) {
    return failResetPasswordCompleteException({ context, error });
  }
}
