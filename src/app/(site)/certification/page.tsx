import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import PageHeader from "@/components/ui/PageHeader";
import { getHeaderSession } from "@/lib/header-session";
import { getSignedUserSession } from "@/lib/user-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import CertificationView from "@/components/certification/CertificationView";
import CertificationFooterActions from "@/components/certification/CertificationFooterActions";
import CertificationProfileSync from "@/components/certification/CertificationProfileSync";
import { SITE_NAME } from "@/lib/site";
import { sanitizeReturnTo } from "@/lib/return-to";
import { listCohortCardThemes } from "@/lib/cohort-card-themes";

export const metadata: Metadata = {
  title: `내 인증 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

type CertificationMember = {
  mm_username: string;
  display_name?: string | null;
  year?: number | null;
  campus?: string | null;
  avatar_url?: string | null;
  avatar_updated_at?: string | null;
  has_legacy_avatar?: boolean | null;
};

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

  const [headerSession, cohortCardThemes] = await Promise.all([
    getHeaderSession(session.userId),
    listCohortCardThemes(),
  ]);

  const supabase = getSupabaseAdminClient();
  const { data: member } = await supabase
    .from("members")
    .select(
      "mm_username,display_name,year,campus,avatar_content_type,avatar_url,updated_at",
    )
    .eq("id", session.userId)
    .maybeSingle();

  if (!member) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

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
            <CertificationView
              member={{
                mm_username: member.mm_username,
                display_name: member.display_name,
                year: member.year,
                campus: member.campus,
                avatar_url: member.avatar_url,
                avatar_updated_at: member.updated_at,
                has_legacy_avatar: Boolean(member.avatar_content_type),
              } satisfies CertificationMember}
              initialTimestamp={initialTimestamp}
              cohortCardThemes={cohortCardThemes}
            />
            <div className="mt-10 w-full border-t border-border/70 pt-8">
              <CertificationFooterActions />
            </div>
          </div>
          <CertificationProfileSync />
        </Container>
      </main>
    </div>
  );
}
