import { NextResponse } from "next/server";

/**
 * Pure decision and response mapping for member API session checks. A forced
 * password change is a security control (see member-required-gates): until
 * it is done the member may only change the password, give consent, or sign
 * out, so write APIs reject the request even though the signed session itself
 * is valid. The request-bound helper lives in `member-api-session.ts`.
 */

export type MemberApiSessionDenial = "unauthorized" | "password_change_required";

export const MEMBER_API_SESSION_DENIALS: Record<
  MemberApiSessionDenial,
  { status: 401 | 403; message: string }
> = {
  unauthorized: { status: 401, message: "로그인이 필요합니다." },
  password_change_required: {
    status: 403,
    message: "비밀번호를 변경한 뒤 다시 시도해 주세요.",
  },
};

export type MemberApiSessionOptions = {
  /** Only for requests that reduce exposure, such as push unsubscribe. */
  allowPasswordChangeRequired?: boolean;
};

export function resolveMemberApiSessionDenial(
  session: { userId?: string | null; mustChangePassword?: boolean } | null | undefined,
  options: MemberApiSessionOptions = {},
): MemberApiSessionDenial | null {
  if (!session?.userId) {
    return "unauthorized";
  }
  if (session.mustChangePassword && !options.allowPasswordChangeRequired) {
    return "password_change_required";
  }
  return null;
}

export function memberApiSessionDeniedResponse(denial: MemberApiSessionDenial) {
  const { status, message } = MEMBER_API_SESSION_DENIALS[denial];
  return NextResponse.json({ ok: false, error: denial, message }, { status });
}
