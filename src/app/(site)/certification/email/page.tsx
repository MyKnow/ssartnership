import type { Metadata } from "next";
import { redirect } from "next/navigation";
import MemberEmailVerificationView from "@/components/certification/MemberEmailVerificationView";
import MemberEmailVerificationPageHeader from "@/components/certification/MemberEmailVerificationPageHeader";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import { getHeaderSession } from "@/lib/header-session";
import { getMemberCanonicalProfile } from "@/lib/member-profile-view";
import { getMemberGateCompletionReturnTo } from "@/lib/member-required-gates";
import { SITE_NAME } from "@/lib/site";
import { getUserSession } from "@/lib/user-auth";

export const metadata: Metadata = {
  title: `로그인·복구 이메일 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

export default async function CertificationEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const rawReturnTo = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;
  const completionHref = getMemberGateCompletionReturnTo(
    rawReturnTo ?? "/certification",
    "email-registration",
  );
  const pageHref = `/certification/email?returnTo=${encodeURIComponent(completionHref)}`;
  const session = await getUserSession();
  if (!session?.userId) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(pageHref)}`);
  }

  const [headerSession, member] = await Promise.all([
    getHeaderSession(session.userId),
    getMemberCanonicalProfile(session.userId),
  ]);
  if (!member) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(pageHref)}`);
  }
  const emailRegistrationRequired = session.requiresEmailRegistration;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <div className="mx-auto w-full max-w-2xl space-y-6">
            <MemberEmailVerificationPageHeader
              emailRegistrationRequired={emailRegistrationRequired}
              completionHref={completionHref}
            />
            <MemberEmailVerificationView
              initialEmail={member.email}
              emailVerified={Boolean(member.emailVerifiedAt)}
              completionHref={completionHref}
            />
          </div>
        </Container>
      </main>
    </div>
  );
}
