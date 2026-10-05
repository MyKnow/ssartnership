import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PartnerPlanScreen from "@/components/partner/PartnerPlanScreen";
import {
  cancelPartnerPlanUpgradeRequestAction,
  requestPartnerPlanUpgradeAction,
} from "@/app/partner/plans/actions";
import { getPartnerBillingProfiles } from "@/lib/partner-billing-profiles";
import { getPartnerBankTransferAccount } from "@/lib/partner-billing-config";
import {
  PARTNER_PLAN_STATUS_MESSAGES,
  resolvePartnerPlanErrorParam,
  resolvePartnerPlanStatusParam,
} from "@/lib/partner-plan-safe-messages";
import { getPartnerPlanPortalData } from "@/lib/partner-plan-service";
import { getPartnerPasswordChangeHref } from "@/lib/partner-auth/portal-paths";
import { assertPartnerPortalCompanyAccess } from "@/lib/partner-auth/portal-scope";
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

export default async function PartnerCompanyPlansPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<{
    status?: string | string[];
    error?: string | string[];
  }>;
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

  const paramsData = (await searchParams) ?? {};
  const [data, billingProfiles] = await Promise.all([
    getPartnerPlanPortalData([scope.id], session.accountId),
    getPartnerBillingProfiles({
      accountId: session.accountId,
      companyId: scope.id,
    }),
  ]);
  const bankTransferAccount = getPartnerBankTransferAccount();
  const status = resolvePartnerPlanStatusParam(paramsData.status);
  const statusMessage = status ? PARTNER_PLAN_STATUS_MESSAGES[status] : null;
  const errorMessage = resolvePartnerPlanErrorParam(paramsData.error);

  return (
    <PartnerPlanScreen
      data={data}
      companyId={scope.id}
      companyName={scope.name}
      bankTransferAccount={bankTransferAccount}
      billingProfiles={billingProfiles}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      actions={{
        requestUpgrade: requestPartnerPlanUpgradeAction,
        cancelUpgrade: cancelPartnerPlanUpgradeRequestAction,
      }}
    />
  );
}
