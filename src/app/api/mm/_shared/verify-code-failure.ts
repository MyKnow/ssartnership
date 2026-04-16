import { getRequestLogContext, logAuthSecurity } from "@/lib/activity-logs";
import {
  delayMemberAuthFailure,
  recordMemberAuthFailure,
} from "./throttle";
import { mmErrorResponse } from "./responses";
import type { MemberAuthThrottleContext, MmRouteContext } from "./types";

type FailVerifyCodeParams = {
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
};

export async function failVerifyCode({
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
}: FailVerifyCodeParams) {
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

export async function failVerifyCodeException(
  request: Request,
  error: unknown,
) {
  const context = getRequestLogContext(request);
  await logAuthSecurity({
    ...context,
    eventName: "member_signup_complete",
    status: "failure",
    actorType: "guest",
    properties: {
      reason: "exception",
      message: error instanceof Error ? error.message : "unknown_error",
    },
  });
  await delayMemberAuthFailure("verify-code", true);

  return mmErrorResponse(
    "verify_failed",
    503,
    "인증 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  );
}
