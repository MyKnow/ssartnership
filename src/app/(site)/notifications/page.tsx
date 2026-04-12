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
          <div className="mx-auto max-w-4xl space-y-6">
            <ShellHeader
              eyebrow="Notifications"
              title="알림 설정"
              description="기기별 푸시 알림 수신 여부와 세부 알림 항목을 관리합니다."
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
