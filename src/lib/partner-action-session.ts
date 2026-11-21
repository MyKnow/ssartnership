import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getPartnerSessionExpiredLoginHref,
  resolvePartnerActionSessionRedirect,
} from "@/lib/partner-auth/return-to";
import { getPartnerSession, type PartnerSession } from "@/lib/partner-session";
import { getForwardedRequestPath } from "@/lib/request-path";

/**
 * 파트너 포털 server action 공용 세션 가드.
 * 세션이 만료되면 `/partner/login?error=session_expired`로, 비밀번호 변경이
 * 필요하면 `/partner/change-password`로 이동시키고, 통과하면 세션을 돌려준다.
 * 두 이동 모두 action을 제출한 화면을 `returnTo`로 싣는다. server action은
 * 렌더된 페이지 주소로 POST되므로 proxy가 전달한 요청 경로가 곧 그 화면이다
 * (Referer처럼 브라우저 설정에 따라 빠지지 않는다).
 */
export async function requirePartnerActionSession(): Promise<PartnerSession> {
  const session = await getPartnerSession();
  if (session && !session.mustChangePassword) {
    return session;
  }

  const requestPath = getForwardedRequestPath(await headers());
  redirect(
    resolvePartnerActionSessionRedirect(session, requestPath) ??
      getPartnerSessionExpiredLoginHref(),
  );
}
