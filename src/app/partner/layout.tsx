import { Suspense } from "react";
import RoutePageViewTracker from "@/components/analytics/RoutePageViewTracker";
import PartnerPortalShellView from "@/components/partner/PartnerPortalShellView";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import { getPartnerSession } from "@/lib/partner-session";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPartnerSession();

  return (
    <>
      <Suspense fallback={null}>
        <RoutePageViewTracker area="partner" />
      </Suspense>
      <PartnerPortalShellView session={session} isMock={isPartnerPortalMock}>
        {children}
      </PartnerPortalShellView>
    </>
  );
}
