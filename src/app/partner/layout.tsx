import { Suspense } from "react";
import RoutePageViewTracker from "@/components/analytics/RoutePageViewTracker";
import PartnerPortalShellView from "@/components/partner/PartnerPortalShellView";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import { getPartnerPortalCompanySummaries } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { loadPartnerShellCompanies } from "@/lib/partner-shell-companies";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPartnerSession();
  // A failed summary read keeps the shell usable without company navigation;
  // the shell then shows an inline notice instead of looking company-less.
  const { companies, unavailable: companiesUnavailable } = session
    ? await loadPartnerShellCompanies(
        session.companyIds,
        getPartnerPortalCompanySummaries,
      )
    : { companies: [], unavailable: false };

  return (
    <>
      <Suspense fallback={null}>
        <RoutePageViewTracker area="partner" />
      </Suspense>
      <PartnerPortalShellView
        session={session}
        companies={companies}
        companiesUnavailable={companiesUnavailable}
        isMock={isPartnerPortalMock}
      >
        {children}
      </PartnerPortalShellView>
    </>
  );
}
