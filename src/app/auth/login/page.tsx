import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { getHeaderSession } from "@/lib/header-session";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import LoginForm from "@/components/auth/LoginForm";
import SsafyVerifyButton from "@/components/auth/SsafyVerifyButton";
import { SITE_NAME } from "@/lib/site";
import { sanitizeReturnTo } from "@/lib/return-to";

export const metadata: Metadata = {
  title: `로그인 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function LoginPage({
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
            <h1 className="text-2xl font-semibold text-foreground">로그인</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              SSAFY Verify로 구성원 인증을 완료해 싸트너십을 이용합니다.
            </p>
            <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                권장 로그인
              </p>
              <h2 className="mt-2 text-lg font-semibold text-foreground">
                SSAFY Verify 로그인
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                인증이 완료되면 기존 회원은 바로 로그인되고, 신규 회원은 가입
                완료 화면으로 이동합니다.
              </p>
              <SsafyVerifyButton returnTo={returnTo} />
            </div>
            <details className="mt-5 rounded-2xl border border-border bg-surface-muted/60">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-4 outline-none transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/20 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    기존 사이트 비밀번호로 로그인
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    전환 기간 동안 SSAFY Verify 사용이 어려운 기존 계정에만 제공합니다.
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  보조
                </span>
              </summary>
              <div className="border-t border-border px-4 pb-4">
                <LoginForm returnTo={returnTo} />
              </div>
            </details>
          </Card>
        </Container>
      </main>
    </div>
  );
}
