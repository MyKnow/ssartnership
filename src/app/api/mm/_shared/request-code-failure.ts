import { logAuthSecurity } from "@/lib/activity-logs";
import {
  delayMemberAuthFailure,
  recordMemberAuthFailure,
} from "./throttle";
import { mmErrorResponse } from "./responses";
import type { MemberAuthThrottleContext, MmRouteContext } from "./types";

export function getRequestCodeLogProperties(
  year: number | null,
  extra: Record<string, unknown> = {},
) {
  return {
    year,
    ...extra,
  };
}

export async function failRequestCode({
  context,
  throttleContext,
  year,
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
  year: number | null;
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
    eventName: "member_signup_code_request",
    status: blockedDelay ? "blocked" : "failure",
    actorType,
    actorId,
    identifier: identifier ?? null,
    properties: getRequestCodeLogProperties(year, { reason, ...extra }),
  });

  if (recordFailure) {
    await recordMemberAuthFailure("request-code", throttleContext, blockedDelay);
  } else {
    await delayMemberAuthFailure("request-code", blockedDelay);
  }

  return mmErrorResponse(error, status, message);
}

export async function failRequestCodeException({
  context,
  year,
  error,
}: {
  context: MmRouteContext;
  year: number | null;
  error: unknown;
}) {
  await logAuthSecurity({
    ...context,
    eventName: "member_signup_code_request",
    status: "failure",
    actorType: "guest",
    properties: getRequestCodeLogProperties(year, {
      reason: "exception",
      message: error instanceof Error ? error.message : "unknown_error",
    }),
  });
  await delayMemberAuthFailure("request-code", true);

  return mmErrorResponse(
    "request_failed",
    503,
    "인증코드 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  );
}
