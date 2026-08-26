import type { Metadata } from "next";
import { redirect } from "next/navigation";
import MemberEmailVerificationView from "@/components/certification/MemberEmailVerificationView";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import PageHeader from "@/components/ui/PageHeader";
import { getHeaderSession } from "@/lib/header-session";
import { getMemberCanonicalProfile } from "@/lib/member-profile-view";
import { sanitizeReturnTo } from "@/lib/return-to";
import { SITE_NAME } from "@/lib/site";
import { getSignedUserSession } from "@/lib/user-auth";

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
  const completionHref = sanitizeReturnTo(rawReturnTo, "/certification");
  const pageHref = `/certification/email?returnTo=${encodeURIComponent(completionHref)}`;
  const session = await getSignedUserSession();
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

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <div className="mx-auto w-full max-w-2xl space-y-6">
            <PageHeader
              title="로그인·복구 이메일"
              description="로그인과 비밀번호 재설정에 사용할 이메일을 인증합니다."
              backHref={completionHref}
              backLabel="이전 화면으로 돌아가기"
              className="border-b-0"
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
