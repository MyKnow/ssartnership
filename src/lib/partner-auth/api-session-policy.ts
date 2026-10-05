import { NextResponse } from "next/server";

/**
 * Pure decision and response mapping for partner API session checks. A forced
 * password change (temporary password after reset or first login) is a
 * security control: until it is done the partner may only change the
 * password or reduce exposure (sign out, unsubscribe push). The request-bound
 * helper lives in `api-session.ts`; the member equivalent follows the same
 * 401/403 contract.
 */

export type PartnerApiSessionDenial = "unauthorized" | "password_change_required";

export const PARTNER_API_SESSION_DENIALS: Record<
  PartnerApiSessionDenial,
  { status: 401 | 403; message: string }
> = {
  unauthorized: { status: 401, message: "로그인이 필요합니다." },
  password_change_required: {
    status: 403,
    message: "비밀번호를 변경한 뒤 다시 시도해 주세요.",
  },
};

export type PartnerApiSessionOptions = {
  /** Only for requests that reduce exposure, such as push unsubscribe. */
  allowPasswordChangeRequired?: boolean;
};

export function resolvePartnerApiSessionDenial(
  session:
    | { accountId?: string | null; mustChangePassword?: boolean | null }
    | null
    | undefined,
  options: PartnerApiSessionOptions = {},
): PartnerApiSessionDenial | null {
  if (!session?.accountId) {
    return "unauthorized";
  }
  if (session.mustChangePassword && !options.allowPasswordChangeRequired) {
    return "password_change_required";
  }
  return null;
}

export function partnerApiSessionDeniedResponse(denial: PartnerApiSessionDenial) {
  const { status, message } = PARTNER_API_SESSION_DENIALS[denial];
  return NextResponse.json({ ok: false, error: denial, message }, { status });
}
