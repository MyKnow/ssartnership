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
        <Container className="pb-16 pt-8 sm:pt-10" size="wide">
          <div className="mx-auto max-w-5xl space-y-5">
            <ShellHeader
              eyebrow="Suggestion"
              title="제휴 제안"
              description="SSAFY 구성원이 실제로 사용할 수 있는 혜택을 제안해 주세요. 핵심 조건과 연락처만 명확하면 충분합니다."
              className="px-5 py-5 sm:px-6 sm:py-6"
            />
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <Card tone="elevated" padding="md">
                <SuggestForm />
              </Card>

              <Card
                tone="muted"
                padding="md"
                className="order-first space-y-4 lg:sticky lg:top-24 lg:order-none"
              >
                <div className="space-y-2">
                  <p className="ui-kicker">Guide</p>
                  <h2 className="text-lg font-semibold text-foreground">작성 기준</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    제안서는 길 필요가 없습니다. 검토에 필요한 핵심 정보만
                    빠르게 확인할 수 있으면 됩니다.
                  </p>
                </div>

                <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                  <li className="rounded-card border border-border/70 bg-surface-inset/80 px-4 py-3">
                    <strong className="block text-foreground">혜택</strong>
                    할인율, 증정, 예약 우대처럼 사용자가 바로 이해할 수 있는 조건
                  </li>
                  <li className="rounded-card border border-border/70 bg-surface-inset/80 px-4 py-3">
                    <strong className="block text-foreground">인증 방식</strong>
                    SSAFY 인증 화면, 기수 확인, 현장 확인 등 실제 사용 방식
                  </li>
                  <li className="rounded-card border border-border/70 bg-surface-inset/80 px-4 py-3">
                    <strong className="block text-foreground">사용 범위</strong>
                    적용 지점, 기간, 제외 메뉴, 예약 가능 여부
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
