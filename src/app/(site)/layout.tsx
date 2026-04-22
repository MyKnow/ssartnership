import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Footer from "@/components/Footer";
import ScrollToTopFab from "@/components/ScrollToTopFab";
import RoutePageViewTracker from "@/components/analytics/RoutePageViewTracker";
import { getUserSession } from "@/lib/user-auth";
import { sanitizeReturnTo } from "@/lib/return-to";

export const dynamic = "force-dynamic";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const returnTo = sanitizeReturnTo(headerStore.get("next-url"), "/");
  const session = await getUserSession();
  if (session?.requiresConsent) {
    redirect(`/auth/consent?returnTo=${encodeURIComponent(returnTo)}`);
  }
  if (session?.mustChangePassword) {
    redirect(`/auth/change-password?returnTo=${encodeURIComponent(returnTo)}`);
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
