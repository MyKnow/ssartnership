import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { getHeaderSession } from "@/lib/header-session";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { SITE_NAME } from "@/lib/site";
import { sanitizeReturnTo } from "@/lib/return-to";

export const metadata: Metadata = {
  title: `회원가입 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const headerSession = await getHeaderSession();
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = sanitizeReturnTo(
    Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo,
    "/",
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-lg p-6">
            <h1 className="text-2xl font-semibold text-foreground">회원가입</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              SSAFY Verify 기반 가입으로 전환 중입니다.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button
                href={`/auth/ssafy?returnTo=${encodeURIComponent(returnTo)}`}
              >
                SSAFY 인증으로 계속하기
              </Button>
              <Button variant="ghost" href="/auth/login">
                로그인으로 돌아가기
              </Button>
            </div>
          </Card>
        </Container>
      </main>
    </div>
  );
}
