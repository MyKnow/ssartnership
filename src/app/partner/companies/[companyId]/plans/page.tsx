import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Container from "@/components/ui/Container";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import PartnerPlanManagementView from "@/components/partner/PartnerPlanManagementView";
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
  const data = await getPartnerPlanPortalData([scope.id], session.accountId);
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
    <Container size="wide" className="pb-16 pt-6 lg:pt-8">
      <div className="space-y-6">
        <ShellHeader
          eyebrow="Partner Portal"
          title="플랜 관리"
          description={`${scope.name} 소유 브랜드의 플랜과 업그레이드 요청 상태를 확인합니다.`}
        />
        {statusMessage ? <FormMessage variant="info">{statusMessage}</FormMessage> : null}
        {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}
        <PartnerPlanManagementView
          data={data}
          companyId={scope.id}
          bankTransferAccount={bankTransferAccount}
        />
      </div>
    </Container>
  );
}
