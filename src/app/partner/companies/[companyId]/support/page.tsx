import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PartnerSupportRequestPanel from "@/components/partner/PartnerSupportRequestPanel";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import { getPartnerPortalDashboard } from "@/lib/partner-dashboard";
import { assertPartnerPortalCompanyAccess } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { BUG_REPORT_EMAIL, SITE_NAME } from "@/lib/site";
import {
  getCompanyScopedPortalHref,
  getPartnerPasswordChangeHref,
} from "@/lib/partner-portal-paths";

export const metadata: Metadata = {
  title: `기술 지원 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PartnerCompanySupportPage({
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

  const dashboard = await getPartnerPortalDashboard([scope.id]);
  const brandNames =
    dashboard.companies[0]?.services.map((service) => service.name).join(", ") ||
    "미지정";
  const supportPath = getCompanyScopedPortalHref(scope.id, "support");

  return (
    <Container size="wide" className="pb-16 pt-6 lg:pt-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <ShellHeader
          eyebrow="Support"
          title="기술 지원"
          description={`${scope.name} 포털 이용 중 문제가 있거나 지원이 필요하면 아래 템플릿으로 문의해 주세요.`}
        />
        <Card className="space-y-4 xl:sticky xl:top-24">
          <p className="ui-kicker">운영 안내</p>
          <div className="space-y-2 text-sm leading-6 text-muted-foreground">
            <p>서비스 정보 수정은 브랜드 상세의 수정 요청 화면에서 먼저 처리합니다.</p>
            <p>로그인, 초기 설정, 알림 수신 같은 계정 문제는 아래 템플릿으로 문의합니다.</p>
          </div>
        </Card>
        <div className="min-w-0 xl:col-span-2">
          <PartnerSupportRequestPanel
            to={BUG_REPORT_EMAIL}
            siteName={SITE_NAME}
            companyName={scope.name}
            brandNames={brandNames}
            displayName={session.displayName}
            loginId={session.loginId}
            currentUrl={supportPath}
          />
        </div>
      </div>
    </Container>
  );
}
