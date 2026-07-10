import SupportTemplateCard from "@/components/support/SupportTemplateCard";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import type { SupportMailTemplate } from "@/lib/support-mail";

export default function BugReportView({
  template,
}: {
  template: SupportMailTemplate;
}) {
  return (
    <main>
      <Container className="pb-16 pt-10" size="wide">
        <div className="mx-auto max-w-3xl space-y-5">
          <ShellHeader
            eyebrow="Bug Report"
            title="버그 제보"
            description="문제가 발생한 화면과 재현 방법을 남겨 주세요. 템플릿을 복사해 사용하는 방식이 가장 안정적입니다."
          />
          <SupportTemplateCard
            template={template}
            description="메일 앱이 바로 열리지 않는 환경에서는 템플릿을 복사한 뒤 사용 중인 메일 서비스에 붙여넣어 보내 주세요."
          />
        </div>
      </Container>
    </main>
  );
}
