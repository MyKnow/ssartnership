import { notFound, permanentRedirect, redirect } from "next/navigation";
import {
  getPartnerGlobalPortalHref,
  getPartnerPasswordChangeHref,
} from "@/lib/partner-portal-paths";
import { assertPartnerPortalCompanyAccess } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";

export const dynamic = "force-dynamic";

export default async function PartnerCompanyAccountCompatibilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<{ status?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect(getPartnerPasswordChangeHref(companyId));
  }

  const scope = await assertPartnerPortalCompanyAccess(session, companyId);
  if (!scope) {
    notFound();
  }

  const legacyParams = (await searchParams) ?? {};
  const nextParams = new URLSearchParams({ companyId: scope.id });
  if (legacyParams.status) {
    nextParams.set("status", legacyParams.status);
  }
  if (legacyParams.error) {
    nextParams.set("error", legacyParams.error);
  }
  permanentRedirect(
    `${getPartnerGlobalPortalHref("account")}?${nextParams.toString()}`,
  );
}
