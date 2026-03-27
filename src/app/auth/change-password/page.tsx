import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import { getUserSession } from "@/lib/user-auth";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";

export const metadata = {
  title: "비밀번호 변경 | SSARTNERSHIP",
};

export default async function ChangePasswordPage() {
  const session = await getUserSession();
  if (!session?.userId) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-lg p-6">
            <h1 className="text-2xl font-semibold text-foreground">
              비밀번호 변경
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              보안을 위해 새로운 비밀번호로 변경해 주세요.
            </p>
            <ChangePasswordForm />
          </Card>
        </Container>
      </main>
    </div>
  );
}
