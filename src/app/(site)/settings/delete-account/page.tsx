import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import MemberAccountDeletionView from "@/components/settings/MemberAccountDeletionView";
import Container from "@/components/ui/Container";
import { getHeaderSession } from "@/lib/header-session";
import { SITE_NAME } from "@/lib/site";
import { getMemberAccountDeletionNavigation } from "@/lib/site-navigation";
import { getSignedUserSession } from "@/lib/user-auth";

export const metadata: Metadata = {
  title: `회원 탈퇴 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const { settingsHref, deletionHref } = getMemberAccountDeletionNavigation(
    params.returnTo,
  );
  const session = await getSignedUserSession();

  if (!session?.userId) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(deletionHref)}`);
  }

  const headerSession = await getHeaderSession(session.userId);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10" size="wide">
          <div className="mx-auto w-full max-w-2xl">
            <MemberAccountDeletionView settingsHref={settingsHref} />
          </div>
        </Container>
      </main>
    </div>
  );
}
