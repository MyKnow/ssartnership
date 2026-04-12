import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { getHeaderSession } from "@/lib/header-session";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import ShellHeader from "@/components/ui/ShellHeader";
import SuggestForm from "@/components/SuggestForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `제휴 제안하기 | ${SITE_NAME}`,
  description: `${SITE_NAME}에 SSAFY 제휴 제안을 남겨주세요.`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function SuggestPage() {
  const headerSession = await getHeaderSession();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader suggestHref="/suggest" initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10" size="wide">
          <div className="mx-auto max-w-4xl space-y-6">
            <ShellHeader
              eyebrow="Suggestion"
              title="제휴 제안하기"
              description="파트너십 제안 내용을 작성해 주세요. 제출 시 사본이 입력한 담당자 이메일로 발송됩니다."
            />
            <Card tone="elevated">
              <SuggestForm />
            </Card>
          </div>
        </Container>
      </main>
    </div>
  );
}
