import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import SiteHeader from "@/components/SiteHeader";
import { getEventPageDefinition } from "@/lib/event-pages";
import { getEventRewardWinnerGuide } from "@/lib/promotions/event-rewards";
import { getHeaderSession } from "@/lib/header-session";
import { getSignedUserSession } from "@/lib/user-auth";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `당첨 안내 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

export default async function EventWinnerFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const definition = getEventPageDefinition(slug);
  if (!definition) {
    notFound();
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    redirect("/auth/login");
  }

  const [headerSession, guide] = await Promise.all([
    getHeaderSession(session.userId),
    getEventRewardWinnerGuide({
      eventSlug: slug,
      memberId: session.userId,
    }),
  ]);

  if (!guide) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-8 sm:pt-10" size="narrow">
          <Card tone="elevated" className="grid gap-5">
            <div>
              <p className="ui-kicker">Winner</p>
              <h1 className="mt-2 text-2xl font-semibold text-foreground">
                {definition.shortTitle} 당첨 안내
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {guide.rank}번째 당첨자로 확정되었습니다. 기프티콘 발송을 위해 아래 구글폼에 정보를 입력해 주세요.
              </p>
            </div>
            <div className="rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3 text-sm text-muted-foreground">
              보유 추첨권 {guide.ticketCount.toLocaleString()}장 기준으로 추첨되었습니다.
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button href={guide.googleFormUrl} target="_blank" className="w-full sm:w-auto">
                구글폼 작성
              </Button>
              <Button href={`/events/${slug}`} variant="secondary" className="w-full sm:w-auto">
                이벤트 보기
              </Button>
            </div>
          </Card>
        </Container>
      </main>
    </div>
  );
}
