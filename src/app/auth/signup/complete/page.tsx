import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SsafySignupCompleteForm from "@/components/auth/SsafySignupCompleteForm";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import { getHeaderSession } from "@/lib/header-session";
import {
  getActiveRequiredPolicies,
  getPolicyDocumentByKind,
} from "@/lib/policy-documents";
import { sanitizeReturnTo } from "@/lib/return-to";
import { SITE_NAME } from "@/lib/site";
import { getSsafySignupSession } from "@/lib/ssafy-verify/signup-session";

export const metadata: Metadata = {
  title: `회원가입 완료 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function SignupCompletePage({ searchParams }: PageProps) {
  const signupSession = await getSsafySignupSession();
  if (!signupSession) {
    redirect("/auth/signup");
  }

  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = sanitizeReturnTo(
    Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo,
    "/",
  );
  const [headerSession, requiredPolicies, marketingPolicy] = await Promise.all([
    getHeaderSession(),
    getActiveRequiredPolicies(),
    getPolicyDocumentByKind("marketing"),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-2xl p-6 sm:p-8">
            <h1 className="text-2xl font-semibold text-foreground">회원가입 완료</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              SSAFY Verify 인증 정보로 싸트너십 계정을 생성합니다.
            </p>
            <SsafySignupCompleteForm
              session={signupSession}
              requiredPolicies={requiredPolicies}
              marketingPolicy={marketingPolicy}
              returnTo={returnTo}
            />
          </Card>
        </Container>
      </main>
    </div>
  );
}
