import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { getHeaderSession } from "@/lib/header-session";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import SignupForm from "@/components/auth/SignupForm";
import FormMessage from "@/components/ui/FormMessage";
import { getActiveRequiredPolicies } from "@/lib/policy-documents";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `회원가입 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function SignupPage() {
  const headerSession = await getHeaderSession();
  let policies = null;
  let policyError: string | null = null;

  try {
    policies = await getActiveRequiredPolicies();
  } catch (error) {
    policyError = (error as Error).message;
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-lg p-6">
            <h1 className="text-2xl font-semibold text-foreground">회원가입</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Mattermost 아이디로 본인 인증을 진행합니다.
            </p>
            {policies ? (
              <SignupForm policies={policies} />
            ) : (
              <div className="mt-6">
                <FormMessage variant="error">
                  {policyError ?? "약관 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
                </FormMessage>
              </div>
            )}
          </Card>
        </Container>
      </main>
    </div>
  );
}
