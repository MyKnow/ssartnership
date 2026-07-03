import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCompanyScopedPortalHref } from "@/lib/partner-portal-paths";
import { getPartnerPortalCompanySummaries } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `플랜 관리 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PartnerPlansPage() {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const companies = await getPartnerPortalCompanySummaries(session.companyIds);
  if (companies.length === 1 && companies[0]) {
    redirect(getCompanyScopedPortalHref(companies[0].id, "plans"));
  }
  redirect("/partner");
}
