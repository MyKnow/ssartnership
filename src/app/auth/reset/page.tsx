import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "비밀번호 재설정 | SSARTNERSHIP",
};

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-lg p-6">
            <h1 className="text-2xl font-semibold text-foreground">
              비밀번호 재설정
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              가입된 MM 아이디를 입력하면 임시 비밀번호가 발급됩니다.
            </p>
            <ResetPasswordForm />
          </Card>
        </Container>
      </main>
    </div>
  );
}
