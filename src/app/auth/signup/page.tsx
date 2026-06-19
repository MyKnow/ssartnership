import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SsafyVerifyButton from "@/components/auth/SsafyVerifyButton";
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
              SSAFY Verify로 구성원 인증을 완료하면 싸트너십 계정에 연결합니다.
            </p>
            <SsafyVerifyButton returnTo={returnTo} />
            <div className="mt-3 flex flex-col gap-3">
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
