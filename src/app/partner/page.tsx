import type { Metadata } from "next";
import PartnerDashboardView from "@/components/partner/PartnerDashboardView";
import { getPartnerPortalDashboard } from "@/lib/partner-dashboard";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: `업체 포털 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PartnerHomePage() {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const dashboard = await getPartnerPortalDashboard(session.companyIds);

  return <PartnerDashboardView session={session} dashboard={dashboard} />;
}
