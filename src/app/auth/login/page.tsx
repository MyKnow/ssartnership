import SiteHeader from "@/components/SiteHeader";
import { getHeaderSession } from "@/lib/header-session";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = {
  title: "로그인 | SSARTNERSHIP",
};

export default async function LoginPage() {
  const headerSession = await getHeaderSession();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-lg p-6">
            <h1 className="text-2xl font-semibold text-foreground">로그인</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Mattermost 아이디와 사이트 비밀번호로 로그인합니다.
            </p>
            <LoginForm />
          </Card>
        </Container>
      </main>
    </div>
  );
}
