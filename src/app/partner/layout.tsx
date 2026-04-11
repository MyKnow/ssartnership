import { Suspense } from "react";
import RoutePageViewTracker from "@/components/analytics/RoutePageViewTracker";
import PartnerPortalHeader from "@/components/partner/PartnerPortalHeader";
import PartnerPortalFooter from "@/components/partner/PartnerPortalFooter";

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Suspense fallback={null}>
        <RoutePageViewTracker area="partner" />
      </Suspense>
      <PartnerPortalHeader />
      <main className="flex-1">{children}</main>
      <PartnerPortalFooter />
    </div>
  );
}
