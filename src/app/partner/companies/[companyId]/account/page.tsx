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
  title: `프로필 | ${SITE_NAME}`,
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
      ? "프로필이 저장되었습니다."
      : paramsData.status === "defaulted"
        ? "기본 증빙 프로필이 변경되었습니다."
        : paramsData.status === "archived"
          ? "증빙 프로필이 삭제되었습니다."
          : null;
  const errorMessage = paramsData.error
    ? decodeURIComponent(paramsData.error)
    : null;

  return (
    <Container size="wide" className="pb-16 pt-6 lg:pt-8">
      <div className="space-y-6">
        <ShellHeader
          eyebrow="Partner Portal"
          title="프로필"
          description="담당자 계정, 비밀번호, 입금자와 세금계산서 정보를 전체 협력사 공통으로 관리합니다."
        />
        {statusMessage ? (
          <FormMessage variant="info">{statusMessage}</FormMessage>
        ) : null}
        {errorMessage ? (
          <FormMessage variant="error">{errorMessage}</FormMessage>
        ) : null}
        <PartnerAccountInfoView
          companyId={scope.id}
          companyName={scope.name}
          displayName={session.displayName}
          loginId={session.loginId}
          profiles={profiles}
        />
      </div>
    </Container>
  );
}
