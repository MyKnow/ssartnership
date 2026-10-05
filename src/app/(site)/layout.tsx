import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Footer from "@/components/Footer";
import MobileNav from "@/components/MobileNav";
import PwaVisitRecommendation from "@/components/pwa/PwaVisitRecommendation";
import RoutePageViewTracker from "@/components/analytics/RoutePageViewTracker";
import { getMemberRequiredGateRedirect } from "@/lib/member-required-gates";
import { getForwardedRequestPath } from "@/lib/request-path";
import { getUserSession } from "@/lib/user-auth";
import { sanitizeReturnTo } from "@/lib/return-to";

// 세션 게이트(비밀번호 변경·동의·이메일·사진)를 요청마다 판단하므로 (site) 하위 공개
// 페이지는 설계상 동적 렌더링입니다. 하위 page의 `revalidate`·`generateStaticParams`는
// 이 선언 때문에 효과가 없으니 추가하지 말고, 공유 데이터 캐시는 unstable_cache 태그로
// 관리합니다.
export const dynamic = "force-dynamic";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [headerStore, session] = await Promise.all([
    headers(),
    getUserSession(),
  ]);
  const returnTo = sanitizeReturnTo(getForwardedRequestPath(headerStore), "/");
  const requiredGateRedirect = getMemberRequiredGateRedirect({
    currentPath: returnTo,
    returnTo,
    mustChangePassword: session?.mustChangePassword,
    requiresConsent: session?.requiresConsent,
    requiresEmailRegistration: session?.requiresEmailRegistration,
    requiresProfilePhotoUpdate: session?.requiresProfilePhotoUpdate,
  });
  if (requiredGateRedirect) {
    redirect(requiredGateRedirect);
  }
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={null}>
        <RoutePageViewTracker area="site" />
      </Suspense>
      <MobileNav signedInUserId={session?.userId} />
      <PwaVisitRecommendation />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
