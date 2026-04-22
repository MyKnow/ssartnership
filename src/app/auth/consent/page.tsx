import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import PolicyConsentForm from "@/components/auth/PolicyConsentForm";
import { getHeaderSession } from "@/lib/header-session";
import { getUserSession } from "@/lib/user-auth";
import { getMemberPolicyReviewBundle } from "@/lib/policy-documents";
import { SITE_NAME } from "@/lib/site";
import { sanitizeReturnTo } from "@/lib/return-to";

export const metadata: Metadata = {
  title: `약관 동의 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function ConsentPage({ searchParams }: PageProps) {
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = sanitizeReturnTo(
    Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo,
    "",
  );
  const session = await getUserSession();
  if (!session?.userId) {
    redirect("/auth/login");
  }

  if (!session.requiresConsent) {
    if (session.mustChangePassword) {
      const changePasswordReturnTo = returnTo
        ? `/auth/change-password?returnTo=${encodeURIComponent(returnTo)}`
        : "/auth/change-password";
      redirect(changePasswordReturnTo);
    }
    redirect(returnTo || "/");
  }

  const policyReview = await getMemberPolicyReviewBundle(session.userId);
  const headerSession = await getHeaderSession(session.userId);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-2xl p-6 sm:p-8">
            <h1 className="text-2xl font-semibold text-foreground">약관 동의</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              최신 약관 확인이 필요합니다. 서비스를 계속 이용하려면 아래 약관에
              동의해 주세요.
            </p>
            <PolicyConsentForm
              requiredPolicies={policyReview.requiredPolicies}
              reviewPolicies={policyReview.reviewPolicies}
              mustChangePassword={Boolean(session.mustChangePassword)}
              returnTo={returnTo}
            />
          </Card>
        </Container>
      </main>
    </div>
  );
}
