import { logAuthSecurity } from "@/lib/activity-logs";
import {
  delayMemberAuthFailure,
  recordMemberAuthFailure,
} from "./throttle";
import { mmErrorResponse } from "./responses";
import type { MemberAuthThrottleContext, MmRouteContext } from "./types";

export async function failResetPasswordComplete({
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
    eventName: "member_password_reset_complete",
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

export async function failResetPasswordCompleteException({
  context,
  error,
}: {
  context: MmRouteContext;
  error: unknown;
}) {
  await logAuthSecurity({
    ...context,
    eventName: "member_password_reset_complete",
    status: "failure",
    actorType: "guest",
    properties: {
      reason: "exception",
      message: error instanceof Error ? error.message : "unknown_error",
    },
  });
  await delayMemberAuthFailure("reset-password", true);

  return mmErrorResponse(
    "reset_failed",
    503,
    "비밀번호 재설정에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  );
}
