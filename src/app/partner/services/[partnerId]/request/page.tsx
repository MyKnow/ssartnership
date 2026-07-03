import { redirect } from "next/navigation";
import { getCompanyScopedPartnerServiceEditHref } from "@/lib/partner-portal-paths";
import { resolvePartnerPortalCompanyIdForService } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";

export const dynamic = "force-dynamic";

export default async function PartnerServiceRequestRedirectPage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const { partnerId } = await params;
  const companyId = await resolvePartnerPortalCompanyIdForService(session, partnerId);
  if (!companyId) {
    redirect("/partner");
  }
  redirect(getCompanyScopedPartnerServiceEditHref(companyId, partnerId));
}
