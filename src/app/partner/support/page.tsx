import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PartnerSupportScreen from "@/components/partner/PartnerSupportScreen";
import { getPartnerPortalDashboard } from "@/lib/partner-dashboard";
import { getPartnerGlobalPortalHref } from "@/lib/partner-portal-paths";
import { getPartnerPortalCompanySummaries } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { BUG_REPORT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `기술 지원 | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function readSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PartnerSupportPage({
  searchParams,
}: {
  searchParams?: Promise<{ companyId?: string | string[] }>;
}) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const [companies, dashboard] = await Promise.all([
    getPartnerPortalCompanySummaries(session.companyIds),
    getPartnerPortalDashboard(session.companyIds),
  ]);
  const requestedCompanyId = readSearchParam(
    (await searchParams)?.companyId,
  )?.trim();
  const contextCompany =
    companies.find((company) => company.id === requestedCompanyId) ?? null;
  const brandNames =
    dashboard.companies
      .flatMap((company) => company.services.map((service) => service.name))
      .join(", ") || "미지정";
  const companyNames = companies.map((company) => company.name).join(", ") || "미지정";
  const supportPath = getPartnerGlobalPortalHref(
    "support",
    contextCompany?.id ?? null,
  );

  return (
    <PartnerSupportScreen
      to={BUG_REPORT_EMAIL}
      siteName={SITE_NAME}
      companyName={companyNames}
      brandNames={brandNames}
      displayName={session.displayName}
      loginId={session.loginId}
      currentUrl={supportPath}
    />
  );
}
