import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import MemberEmailRecoveryForm from "@/components/auth/MemberEmailRecoveryForm";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `이메일 로그인 복구 | ${SITE_NAME}`,
  robots: { index: false, follow: true },
};

export default function MemberEmailRecoveryPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto min-w-0 max-w-lg p-6">
            <h1 className="text-ko-title text-2xl font-semibold text-foreground">이메일 로그인 복구</h1>
            <MemberEmailRecoveryForm />
          </Card>
        </Container>
      </main>
    </div>
  );
}
