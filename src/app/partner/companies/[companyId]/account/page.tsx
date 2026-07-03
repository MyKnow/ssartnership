import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PartnerAccountInfoView from "@/components/partner/PartnerAccountInfoView";
import Container from "@/components/ui/Container";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import { getPartnerBillingProfiles } from "@/lib/partner-billing-profiles";
import { getPartnerPasswordChangeHref } from "@/lib/partner-portal-paths";
import { assertPartnerPortalCompanyAccess } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `계정 정보 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PartnerCompanyAccountPage({
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
  const profiles = await getPartnerBillingProfiles({
    accountId: session.accountId,
    companyId: scope.id,
  });
  const statusMessage =
    paramsData.status === "created"
      ? "계정 정보가 저장되었습니다."
      : paramsData.status === "defaulted"
        ? "기본 계정 정보가 변경되었습니다."
        : paramsData.status === "archived"
          ? "계정 정보가 삭제되었습니다."
          : null;
  const errorMessage = paramsData.error
    ? decodeURIComponent(paramsData.error)
    : null;

  return (
    <Container size="wide" className="pb-16 pt-6 lg:pt-8">
      <div className="space-y-6">
        <ShellHeader
          eyebrow="Partner Portal"
          title="계정 정보"
          description={`${scope.name}에서 사용할 입금자와 세금계산서 발급 정보를 관리합니다.`}
        />
        {statusMessage ? <FormMessage variant="info">{statusMessage}</FormMessage> : null}
        {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}
        <PartnerAccountInfoView
          companyId={scope.id}
          companyName={scope.name}
          profiles={profiles}
        />
      </div>
    </Container>
  );
}
