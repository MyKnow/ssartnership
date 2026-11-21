import type { NextResponse } from "next/server";
import {
  memberApiSessionDeniedResponse,
  resolveMemberApiSessionDenial,
  type MemberApiSessionOptions,
} from "@/lib/member-api-session-policy";
import { getSignedUserSession } from "@/lib/user-auth";

export {
  MEMBER_API_SESSION_DENIALS,
  memberApiSessionDeniedResponse,
  resolveMemberApiSessionDenial,
  type MemberApiSessionDenial,
  type MemberApiSessionOptions,
} from "@/lib/member-api-session-policy";

export type MemberApiSession = NonNullable<
  Awaited<ReturnType<typeof getSignedUserSession>>
>;

/**
 * Shared session gate for member API routes: 401 without a valid member
 * session, 403 while a forced password change is pending.
 */
export async function requireMemberApiSession(
  options: MemberApiSessionOptions = {},
): Promise<{ session: MemberApiSession } | { response: NextResponse }> {
  const session = await getSignedUserSession();
  const denial = resolveMemberApiSessionDenial(session, options);
  if (denial || !session) {
    return { response: memberApiSessionDeniedResponse(denial ?? "unauthorized") };
  }
  return { session };
}
