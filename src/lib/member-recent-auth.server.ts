import "server-only";

import {
  delayMemberAuthAttempt,
  getMemberAuthBlockingState,
  recordMemberAuthAttempt,
} from "@/lib/member-auth-security";
import {
  MEMBER_RECENT_AUTH_ERRORS,
  isMemberAuthenticationRecent,
  parseMemberCurrentPasswordInput,
  resolveMemberRecentAuthRequirement,
  type MemberRecentAuthErrorCode,
  type MemberRecentAuthRequirement,
} from "@/lib/member-recent-auth";
import {
  isMockMemberAuthEnabled,
  verifyMockMemberCredentials,
} from "@/lib/mock/member";
import { verifyPassword } from "@/lib/password";
import { readMemberPasswordRecord } from "@/lib/repositories/supabase/member-security-repository.supabase";

type RecentAuthSession = {
  userId: string;
  authenticatedAt?: number;
};

type MemberPasswordRecord = { hash: string; salt: string } | null;

async function loadMemberPassword(memberId: string): Promise<MemberPasswordRecord> {
  if (isMockMemberAuthEnabled()) {
    return null;
  }
  return readMemberPasswordRecord(memberId);
}

function memberHasPassword(password: MemberPasswordRecord) {
  return isMockMemberAuthEnabled() || password !== null;
}

/** For pages that render a sensitive form: which proof the member will need. */
export async function getMemberRecentAuthRequirement(
  session: RecentAuthSession,
): Promise<MemberRecentAuthRequirement> {
  if (isMemberAuthenticationRecent(session.authenticatedAt)) {
    return "none";
  }
  try {
    return resolveMemberRecentAuthRequirement({
      authenticatedAt: session.authenticatedAt,
      hasPassword: memberHasPassword(await loadMemberPassword(session.userId)),
    });
  } catch {
    // The API boundary re-checks; the page only decides whether to show the
    // password field up front.
    return "password";
  }
}

export type MemberRecentAuthResult =
  | { ok: true; method: "recent_login" | "current_password" }
  | { ok: false; code: MemberRecentAuthErrorCode };

/**
 * Trust-boundary check for sensitive member actions. Wrong passwords are
 * throttled with the member auth attempt table (route "recent-auth").
 */
export async function verifyMemberRecentAuthentication(input: {
  session: RecentAuthSession;
  currentPassword: unknown;
  ipAddress?: string | null;
}): Promise<MemberRecentAuthResult> {
  if (isMemberAuthenticationRecent(input.session.authenticatedAt)) {
    return { ok: true, method: "recent_login" };
  }

  const parsed = parseMemberCurrentPasswordInput(input.currentPassword);
  if (!parsed.ok) {
    return { ok: false, code: parsed.code };
  }

  let password: MemberPasswordRecord;
  try {
    password = await loadMemberPassword(input.session.userId);
  } catch {
    return { ok: false, code: "recent_auth_unavailable" };
  }
  if (!memberHasPassword(password)) {
    return { ok: false, code: "reauthentication_required" };
  }
  if (!parsed.currentPassword) {
    return { ok: false, code: "recent_auth_required" };
  }

  if (isMockMemberAuthEnabled()) {
    return verifyMockMemberCredentials(process.env.MOCK_ID ?? "", parsed.currentPassword)
      ? { ok: true, method: "current_password" }
      : { ok: false, code: "current_password_invalid" };
  }

  const throttle = {
    ipAddress: input.ipAddress ?? null,
    accountIdentifier: input.session.userId,
  };
  const blockingState = await getMemberAuthBlockingState("recent-auth", throttle);
  if (!blockingState.ok) {
    return { ok: false, code: "recent_auth_unavailable" };
  }
  if (blockingState.blocked) {
    await delayMemberAuthAttempt("recent-auth", true);
    return { ok: false, code: "recent_auth_blocked" };
  }

  if (!password || !verifyPassword(parsed.currentPassword, password.salt, password.hash)) {
    await recordMemberAuthAttempt("recent-auth", throttle, false);
    await delayMemberAuthAttempt("recent-auth");
    return { ok: false, code: "current_password_invalid" };
  }
  await recordMemberAuthAttempt("recent-auth", throttle, true);
  return { ok: true, method: "current_password" };
}

export function getMemberRecentAuthErrorBody(code: MemberRecentAuthErrorCode) {
  return {
    status: MEMBER_RECENT_AUTH_ERRORS[code].status,
    body: { ok: false, error: code, message: MEMBER_RECENT_AUTH_ERRORS[code].message },
  };
}
