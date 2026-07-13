import { notFound, permanentRedirect, redirect } from "next/navigation";
import {
  getPartnerGlobalPortalHref,
  getPartnerPasswordChangeHref,
} from "@/lib/partner-portal-paths";
import { assertPartnerPortalCompanyAccess } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";

export const dynamic = "force-dynamic";

export default async function PartnerCompanySupportCompatibilityPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
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
  permanentRedirect(getPartnerGlobalPortalHref("support", scope.id));
}
