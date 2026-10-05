import { Suspense } from "react";
import RoutePageViewTracker from "@/components/analytics/RoutePageViewTracker";
import PartnerPortalShellView from "@/components/partner/PartnerPortalShellView";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import { getPartnerPortalCompanySummaries } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { logServerError } from "@/lib/server-log";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPartnerSession();
  const companies = session
    ? await getPartnerPortalCompanySummaries(session.companyIds).catch((error: unknown) => {
        // The shell still renders without company navigation; make the
        // degraded state visible to the operator instead of silent.
        logServerError("[partner-layout] company summaries unavailable", error, {
          companyCount: session.companyIds.length,
        });
        return [];
      })
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
