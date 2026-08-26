import type { Metadata } from "next";
import { redirect } from "next/navigation";
import MemberSettingsView from "@/components/settings/MemberSettingsView";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import { getHeaderSession } from "@/lib/header-session";
import { getMemberCanonicalProfile } from "@/lib/member-profile-view";
import { getMemberSettingsNavigation } from "@/lib/site-navigation";
import { SITE_NAME } from "@/lib/site";
import { getSignedUserSession } from "@/lib/user-auth";

export const metadata: Metadata = {
  title: `설정 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const { backHref, settingsHref } = getMemberSettingsNavigation(
    params.returnTo,
  );
  const session = await getSignedUserSession();

  if (!session?.userId) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(settingsHref)}`);
  }

  const [headerSession, member] = await Promise.all([
    getHeaderSession(session.userId),
    getMemberCanonicalProfile(session.userId),
  ]);

  if (!member) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(settingsHref)}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10" size="wide">
          <div className="mx-auto w-full max-w-4xl">
            <MemberSettingsView
              hasMattermostAccount={Boolean(member.mattermostAccountId)}
              email={member.email}
              emailVerified={Boolean(member.emailVerifiedAt)}
              backHref={backHref}
              returnTo={settingsHref}
            />
          </div>
        </Container>
      </main>
    </div>
  );
}
