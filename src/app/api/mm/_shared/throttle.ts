import {
  delayMemberAuthAttempt,
  getMemberAuthAttemptScope,
  getMemberAuthBlockingState,
  recordMemberAuthAttempt,
} from "../../../../lib/member-auth-security.ts";
import type { MemberAuthAction, MemberAuthThrottleContext } from "./types";

export function createMemberAuthThrottleContext(
  ipAddress: string | null,
  accountIdentifier: string | null,
): MemberAuthThrottleContext {
  return {
    ipAddress,
    accountIdentifier,
  };
}

export async function getMemberAuthBlockedState(
  action: MemberAuthAction,
  throttleContext: MemberAuthThrottleContext,
) {
  return getMemberAuthBlockingState(action, throttleContext);
}

export function getMemberAuthBlockedScope(identifier: string | null) {
  return identifier ? getMemberAuthAttemptScope(identifier) : "ip";
}

export async function recordMemberAuthFailure(
  action: MemberAuthAction,
  throttleContext: MemberAuthThrottleContext,
  blocked = false,
) {
  await recordMemberAuthAttempt(action, throttleContext, false);
  await delayMemberAuthAttempt(action, blocked);
}

export async function recordMemberAuthSuccess(
  action: MemberAuthAction,
  throttleContext: MemberAuthThrottleContext,
) {
  await recordMemberAuthAttempt(action, throttleContext, true);
}

export async function delayMemberAuthFailure(
  action: MemberAuthAction,
  blocked = false,
) {
  await delayMemberAuthAttempt(action, blocked);
}
