import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SupportTemplateCard from "@/components/support/SupportTemplateCard";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import { getHeaderSession } from "@/lib/header-session";
import { BUG_REPORT_TEMPLATE } from "@/lib/support-mail";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `버그 제보 | ${SITE_NAME}`,
  description: `${SITE_NAME} 이용 중 발견한 문제를 제보해 주세요.`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function BugReportPage() {
  const headerSession = await getHeaderSession();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10" size="wide">
          <div className="mx-auto max-w-3xl space-y-5">
            <ShellHeader
              eyebrow="Bug Report"
              title="버그 제보"
              description="문제가 발생한 화면과 재현 방법을 남겨 주세요. 템플릿을 복사해 사용하는 방식이 가장 안정적입니다."
            />
            <SupportTemplateCard
              template={BUG_REPORT_TEMPLATE}
              description="메일 앱이 바로 열리지 않는 환경에서는 템플릿을 복사한 뒤 사용 중인 메일 서비스에 붙여넣어 보내 주세요."
            />
          </div>
        </Container>
      </main>
    </div>
  );
}
