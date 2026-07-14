import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Footer from "@/components/Footer";
import ScrollToTopFab from "@/components/ScrollToTopFab";
import RoutePageViewTracker from "@/components/analytics/RoutePageViewTracker";
import { getMemberRequiredGateRedirect } from "@/lib/member-required-gates";
import { getForwardedRequestPath } from "@/lib/request-path";
import { getUserSession } from "@/lib/user-auth";
import { sanitizeReturnTo } from "@/lib/return-to";

export const dynamic = "force-dynamic";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const returnTo = sanitizeReturnTo(getForwardedRequestPath(headerStore), "/");
  const session = await getUserSession();
  const requiredGateRedirect = getMemberRequiredGateRedirect({
    currentPath: returnTo,
    returnTo,
    mustChangePassword: session?.mustChangePassword,
    requiresConsent: session?.requiresConsent,
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
      <div className="flex-1">{children}</div>
      <ScrollToTopFab />
      <Footer />
    </div>
  );
}
