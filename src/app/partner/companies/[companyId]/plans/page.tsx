import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PartnerPlanScreen from "@/components/partner/PartnerPlanScreen";
import {
  cancelPartnerPlanUpgradeRequestAction,
  requestPartnerPlanUpgradeAction,
} from "@/app/partner/plans/actions";
import { getPartnerBillingProfiles } from "@/lib/partner-billing-profiles";
import { getPartnerBankTransferAccount } from "@/lib/partner-billing-config";
import { getPartnerPlanPortalData } from "@/lib/partner-plan-service";
import { getPartnerPasswordChangeHref } from "@/lib/partner-portal-paths";
import { assertPartnerPortalCompanyAccess } from "@/lib/partner-portal-scope";
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

  const paramsData = (await searchParams) ?? {};
  const [data, billingProfiles] = await Promise.all([
    getPartnerPlanPortalData([scope.id], session.accountId),
    getPartnerBillingProfiles({
      accountId: session.accountId,
      companyId: scope.id,
    }),
  ]);
  const bankTransferAccount = getPartnerBankTransferAccount();
  const statusMessage =
    paramsData.status === "requested"
      ? "업그레이드 요청이 접수되었습니다."
      : paramsData.status === "cancelled"
        ? "업그레이드 요청이 취소되었습니다."
        : null;
  const errorMessage = paramsData.error
    ? decodeURIComponent(paramsData.error)
    : null;

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
