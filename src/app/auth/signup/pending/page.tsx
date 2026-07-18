import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import { getHeaderSession } from "@/lib/header-session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `승인 대기 중 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

export default async function SignupPendingPage() {
  const headerSession = await getHeaderSession();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-xl p-6 text-center sm:p-8">
            <p className="ui-kicker">회원가입 신청</p>
            <h1 className="mt-3 text-2xl font-semibold text-foreground">
              승인 대기 중
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              입력하신 Mattermost 계정은 운영진 확인 후 이용할 수 있습니다.
              승인 완료 후 다시 로그인해 주세요.
            </p>
            <Link
              href="/auth/login"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[1rem] border border-transparent bg-primary px-5 text-sm font-semibold text-primary-foreground transition-interactive hover:bg-primary-emphasis"
            >
              로그인 화면으로
            </Link>
          </Card>
        </Container>
      </main>
    </div>
  );
}
