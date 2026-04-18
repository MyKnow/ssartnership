import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import NotificationInbox from "@/components/notifications/NotificationInbox";
import PushSettingsCard from "@/components/push/PushSettingsCard";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import { getMemberNotificationPreferences } from "@/lib/notification-preferences";
import { notificationRepository } from "@/lib/repositories";
import { isPushConfigured } from "@/lib/push";
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

  const [notificationResult, pushPreferences] = await Promise.all([
    notificationRepository.listMemberNotifications({
      memberId: session.userId,
      offset: 0,
      limit: 10,
    }),
    getMemberNotificationPreferences(session.userId),
  ]);
  const headerSession = {
    userId: session.userId,
    notificationUnreadCount: notificationResult.unreadCount,
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10" size="wide">
          <div className="mx-auto max-w-3xl space-y-5">
            <ShellHeader
              title="알림"
              description="알림 수신함을 먼저 보고, 아래에서 푸시, MM, 마케팅 수신을 관리하세요."
              className="px-5 py-4 sm:px-6 sm:py-5"
            />
            <NotificationInbox initialState={notificationResult} />
            <section className="space-y-3">
              <div className="px-5 sm:px-1">
                <h2 className="text-base font-semibold text-foreground">알림 설정</h2>
                <p className="ui-body">
                  푸시, MM, 마케팅 수신을 각각 관리할 수 있습니다.
                </p>
              </div>
              <PushSettingsCard
                initialPreferences={pushPreferences}
                configured={isPushConfigured()}
              />
            </section>
          </div>
        </Container>
      </main>
    </div>
  );
}
