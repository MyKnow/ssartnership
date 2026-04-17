import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import PushSettingsCard from "@/components/push/PushSettingsCard";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import { getMemberPushPreferences, isPushConfigured } from "@/lib/push";
import { getSignedUserSession } from "@/lib/user-auth";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `알림 설정 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function NotificationsPage() {
  const session = await getSignedUserSession();
  if (!session?.userId) {
    redirect("/auth/login");
  }

  const pushPreferences = await getMemberPushPreferences(session.userId);
  const headerSession = { userId: session.userId };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10" size="wide">
          <div className="mx-auto max-w-2xl space-y-4">
            <ShellHeader
              title="알림"
              description="새 제휴, 종료 임박, 운영 공지만 간단하게 받아보세요."
              className="px-5 py-4 sm:px-6 sm:py-5"
            />
            <PushSettingsCard
              initialPreferences={pushPreferences}
              configured={isPushConfigured()}
            />
          </div>
        </Container>
      </main>
    </div>
  );
}
