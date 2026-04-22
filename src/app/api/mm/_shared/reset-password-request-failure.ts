import { logAuthSecurity } from "@/lib/activity-logs";
import {
  delayMemberAuthFailure,
  recordMemberAuthFailure,
} from "./throttle";
import { mmErrorResponse } from "./responses";
import type { MemberAuthThrottleContext, MmRouteContext } from "./types";

export async function failResetPasswordRequest({
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
    eventName: "member_password_reset_request",
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
    await recordMemberAuthFailure(
      "request-reset-code",
      throttleContext,
      blockedDelay,
    );
  } else {
    await delayMemberAuthFailure("request-reset-code", blockedDelay);
  }

  return mmErrorResponse(error, status, message);
}

export async function failResetPasswordRequestException({
  context,
  error,
}: {
  context: MmRouteContext;
  error: unknown;
}) {
  await logAuthSecurity({
    ...context,
    eventName: "member_password_reset_request",
    status: "failure",
    actorType: "guest",
    properties: {
      reason: "exception",
      message: error instanceof Error ? error.message : "unknown_error",
    },
  });
  await delayMemberAuthFailure("request-reset-code", true);

  return mmErrorResponse(
    "request_failed",
    503,
    "인증번호 발급에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  );
}
