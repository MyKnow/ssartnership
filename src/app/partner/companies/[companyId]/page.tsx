import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PartnerDashboardView from "@/components/partner/PartnerDashboardView";
import { getPartnerPortalDashboard } from "@/lib/partner-dashboard";
import { assertPartnerPortalCompanyAccess } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `협력사 대시보드 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PartnerCompanyDashboardPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const { companyId } = await params;
  const scope = await assertPartnerPortalCompanyAccess(session, companyId);
  if (!scope) {
    notFound();
  }

  const dashboard = await getPartnerPortalDashboard([scope.id]);

  return (
    <PartnerDashboardView
      session={session}
      dashboard={dashboard}
      selectedCompany={scope}
    />
  );
}
