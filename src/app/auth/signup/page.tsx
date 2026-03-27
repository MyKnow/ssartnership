import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import SignupForm from "@/components/auth/SignupForm";

export const metadata = {
  title: "회원가입 | SSARTNERSHIP",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-lg p-6">
            <h1 className="text-2xl font-semibold text-foreground">회원가입</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Mattermost 아이디로 본인 인증을 진행합니다.
            </p>
            <SignupForm />
          </Card>
        </Container>
      </main>
    </div>
  );
}
