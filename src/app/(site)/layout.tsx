import { Suspense } from "react";
import { redirect } from "next/navigation";
import Footer from "@/components/Footer";
import ScrollToTopFab from "@/components/ScrollToTopFab";
import RoutePageViewTracker from "@/components/analytics/RoutePageViewTracker";
import { getUserSession } from "@/lib/user-auth";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getUserSession();
  if (session?.requiresConsent) {
    redirect("/auth/consent");
  }
  if (session?.mustChangePassword) {
    redirect("/auth/change-password");
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
