import { Suspense } from "react";
import RoutePageViewTracker from "@/components/analytics/RoutePageViewTracker";
import PartnerPortalShellView from "@/components/partner/PartnerPortalShellView";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import { getPartnerPortalCompanySummaries } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPartnerSession();
  const companies = session
    ? await getPartnerPortalCompanySummaries(session.companyIds).catch(() => [])
    : [];

  return (
    <>
      <Suspense fallback={null}>
        <RoutePageViewTracker area="partner" />
      </Suspense>
      <PartnerPortalShellView
        session={session}
        companies={companies}
        isMock={isPartnerPortalMock}
      >
        {children}
      </PartnerPortalShellView>
    </>
  );
}
