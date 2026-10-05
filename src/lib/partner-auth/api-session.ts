import type { NextResponse } from "next/server";
import { getPartnerSession, type PartnerSession } from "../partner-session.ts";
import {
  partnerApiSessionDeniedResponse,
  resolvePartnerApiSessionDenial,
  type PartnerApiSessionOptions,
} from "./api-session-policy.ts";

export {
  PARTNER_API_SESSION_DENIALS,
  partnerApiSessionDeniedResponse,
  resolvePartnerApiSessionDenial,
  type PartnerApiSessionDenial,
  type PartnerApiSessionOptions,
} from "./api-session-policy.ts";

/**
 * Shared session gate for partner API routes: 401 without a valid partner
 * session (signature, expiry, active account, auth session version and linked
 * companies are revalidated by `getPartnerSession`), 403 while a forced
 * password change is pending. Call it after the same-origin check and before
 * reading the request body.
 */
export async function requirePartnerApiSession(
  options: PartnerApiSessionOptions = {},
): Promise<{ session: PartnerSession } | { response: NextResponse }> {
  const session = await getPartnerSession();
  const denial = resolvePartnerApiSessionDenial(session, options);
  if (denial || !session) {
    return { response: partnerApiSessionDeniedResponse(denial ?? "unauthorized") };
  }
  return { session };
}
