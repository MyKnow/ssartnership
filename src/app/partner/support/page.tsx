import type { Metadata } from "next";
import SupportTemplateCard from "@/components/support/SupportTemplateCard";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import { SITE_NAME } from "@/lib/site";
import { TECH_SUPPORT_TEMPLATE } from "@/lib/support-mail";

export const metadata: Metadata = {
  title: `기술 지원 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function PartnerSupportPage() {
  return (
    <Container className="pb-16 pt-10">
      <div className="mx-auto max-w-3xl space-y-5">
        <ShellHeader
          eyebrow="Support"
          title="기술 지원"
          description="협력사 포털 이용 중 문제가 있거나 지원이 필요하면 아래 템플릿으로 문의해 주세요."
        />
        <SupportTemplateCard
          template={TECH_SUPPORT_TEMPLATE}
          description="메일 앱이 열리지 않으면 템플릿을 복사해 사용 중인 메일 서비스에 붙여넣어 보내 주세요."
        />
      </div>
    </Container>
  );
}
