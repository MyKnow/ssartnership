import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { getHeaderSession } from "@/lib/header-session";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `비밀번호 재설정 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function ResetPasswordPage() {
  const headerSession = await getHeaderSession();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-lg p-6">
            <h1 className="text-2xl font-semibold text-foreground">
              비밀번호 재설정
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              가입된 MM 아이디로 인증번호를 발급받고, 확인이 끝나면 새 비밀번호
              설정 페이지로 이동합니다.
            </p>
            <ResetPasswordForm />
          </Card>
        </Container>
      </main>
    </div>
  );
}
