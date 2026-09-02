import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getCompanyScopedPortalHref,
  getPartnerPasswordChangeHref,
} from "@/lib/partner-portal-paths";
import { getPartnerPortalCompanySummaries } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";
import { readFirstSearchParam } from "@/lib/search-params";

export const metadata: Metadata = {
  title: `플랜 관리 | ${SITE_NAME}`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PartnerPlansCompatibilityPage({
  searchParams,
}: {
  searchParams?: Promise<{
    companyId?: string | string[];
    status?: string | string[];
    error?: string | string[];
  }>;
}) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect(getPartnerPasswordChangeHref(null));
  }

  const companies = await getPartnerPortalCompanySummaries(session.companyIds);
  const legacyParams = (await searchParams) ?? {};
  const requestedCompanyId = readFirstSearchParam(legacyParams.companyId)?.trim();
  const company =
    companies.find((candidate) => candidate.id === requestedCompanyId) ??
    (companies.length === 1 ? companies[0] : null);
  if (!company) {
    redirect("/partner");
  }

  const nextParams = new URLSearchParams();
  const status = readFirstSearchParam(legacyParams.status);
  const error = readFirstSearchParam(legacyParams.error);
  if (status) {
    nextParams.set("status", status);
  }
  if (error) {
    nextParams.set("error", error);
  }
  const query = nextParams.toString();
  redirect(
    `${getCompanyScopedPortalHref(company.id, "plans")}${query ? `?${query}` : ""}`,
  );
}
