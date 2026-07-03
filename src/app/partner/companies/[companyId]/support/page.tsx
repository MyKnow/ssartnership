import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import SupportTemplateCard from "@/components/support/SupportTemplateCard";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import { getPartnerPortalDashboard } from "@/lib/partner-dashboard";
import { assertPartnerPortalCompanyAccess } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import { BUG_REPORT_EMAIL, SITE_NAME } from "@/lib/site";
import { buildSupportMailTemplate } from "@/lib/support-mail";
import { getCompanyScopedPortalHref } from "@/lib/partner-portal-paths";

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
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const { companyId } = await params;
  const scope = await assertPartnerPortalCompanyAccess(session, companyId);
  if (!scope) {
    notFound();
  }

  const dashboard = await getPartnerPortalDashboard([scope.id]);
  const brandNames =
    dashboard.companies[0]?.services.map((service) => service.name).join(", ") ||
    "미지정";
  const supportPath = getCompanyScopedPortalHref(scope.id, "support");
  const template = buildSupportMailTemplate({
    to: BUG_REPORT_EMAIL,
    subject: `[${SITE_NAME} 협력사 포털] ${scope.name} 기술 지원 요청`,
    bodyLines: [
      `1. 업체명 / 브랜드명: ${scope.name} / ${brandNames}`,
      `2. 담당자명: ${session.displayName}`,
      `3. 로그인 이메일: ${session.loginId}`,
      "4. 연락 가능한 전화번호:",
      `5. 문제가 발생한 화면 URL: ${supportPath}`,
      "6. 필요한 지원 내용:",
    ],
  });

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
          <SupportTemplateCard
            template={template}
            description="메일 앱이 열리지 않으면 템플릿을 복사해 사용 중인 메일 서비스에 붙여넣어 보내 주세요."
          />
        </div>
      </div>
    </Container>
  );
}
