import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import PageHeader from "@/components/ui/PageHeader";
import { getHeaderSession } from "@/lib/header-session";
import { getCertificationMemberView } from "@/lib/certification-member-view.server";
import { getSignedUserSession } from "@/lib/user-auth";
import CertificationView from "@/components/certification/CertificationView";
import { SITE_NAME } from "@/lib/site";
import { sanitizeReturnTo } from "@/lib/return-to";
import { listCohortCardThemes } from "@/lib/cohort-card-themes.server";
import Button from "@/components/ui/Button";
import { buildMemberGateHref } from "@/lib/member-required-gates";

export const metadata: Metadata = {
  title: `내 인증 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

function buildCertificationReturnTo(rawReturnTo?: string | string[]) {
  const nestedReturnTo = sanitizeReturnTo(
    Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo,
    "",
  );
  const params = new URLSearchParams();
  if (nestedReturnTo) {
    params.set("returnTo", nestedReturnTo);
  }
  const queryString = params.toString();
  return queryString ? `/certification?${queryString}` : "/certification";
}

export default async function CertificationPage({
  searchParams,
}: {
  searchParams?: Promise<{ returnTo?: string | string[] }>;
}) {
  const initialTimestamp = new Date().toISOString();
  const params = (await searchParams) ?? {};
  const benefitReturnTo = sanitizeReturnTo(
    Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo,
    "",
  );
  const returnTo = buildCertificationReturnTo(params.returnTo);
  const session = await getSignedUserSession();
  if (!session?.userId) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const [headerSession, cohortCardThemes, memberView] = await Promise.all([
    getHeaderSession(session.userId),
    listCohortCardThemes(),
    getCertificationMemberView(session.userId),
  ]);

  if (!memberView) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  const { member, photoAccess } = memberView;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10" size="wide">
          <div className="mx-auto w-full max-w-4xl space-y-6">
            <PageHeader
              eyebrow="Member"
              title="내 인증"
              description="현재 계정의 인증 상태와 표시 정보를 확인합니다."
              backHref={benefitReturnTo}
              backLabel="혜택 화면으로 돌아가기"
            />
            {photoAccess.restrictCertification ? (
              <div className="rounded-3xl border border-border bg-surface p-6 shadow-flat">
                <h2 className="text-lg font-semibold text-foreground">인증 카드 준비 중</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{photoAccess.message}</p>
                <Button
                  className="mt-5"
                  href={buildMemberGateHref("profile-photo", returnTo)}
                >
                  본인 사진 {photoAccess.requiresSubmission ? "제출하기" : "확인하기"}
                </Button>
              </div>
            ) : <CertificationView
              member={member}
              initialTimestamp={initialTimestamp}
              cohortCardThemes={cohortCardThemes}
            />}
          </div>
        </Container>
      </main>
    </div>
  );
}
