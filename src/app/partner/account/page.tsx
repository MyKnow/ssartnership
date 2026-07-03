import { redirect } from "next/navigation";
import {
  getCompanyScopedPortalHref,
  getPartnerPasswordChangeHref,
} from "@/lib/partner-portal-paths";
import { getPartnerPortalCompanySummaries } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";

export const dynamic = "force-dynamic";

export default async function PartnerAccountLegacyPage() {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect(getPartnerPasswordChangeHref(null));
  }

  const companies = await getPartnerPortalCompanySummaries(session.companyIds);
  if (companies.length === 0) {
    redirect("/partner");
  }

  redirect(getCompanyScopedPortalHref(companies[0].id, "account"));
}
