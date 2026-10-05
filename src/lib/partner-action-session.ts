import { redirect } from "next/navigation";
import {
  getPartnerSessionExpiredLoginHref,
  resolvePartnerActionSessionRedirect,
} from "@/lib/partner-portal-paths";
import { getPartnerSession, type PartnerSession } from "@/lib/partner-session";

/**
 * 파트너 포털 server action 공용 세션 가드.
 * 세션이 만료되면 `/partner/login?error=session_expired`로, 비밀번호 변경이
 * 필요하면 `/partner/change-password`로 이동시키고, 통과하면 세션을 돌려준다.
 */
export async function requirePartnerActionSession(): Promise<PartnerSession> {
  const session = await getPartnerSession();
  const redirectHref = resolvePartnerActionSessionRedirect(session);
  if (redirectHref !== null || !session) {
    redirect(redirectHref ?? getPartnerSessionExpiredLoginHref());
  }
  return session;
}
