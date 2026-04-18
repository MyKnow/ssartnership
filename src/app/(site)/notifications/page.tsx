import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import NotificationInbox from "@/components/notifications/NotificationInbox";
import PushSettingsCard from "@/components/push/PushSettingsCard";
import Container from "@/components/ui/Container";
import { getMemberNotificationPreferences } from "@/lib/notification-preferences";
import { notificationRepository } from "@/lib/repositories";
import { isPushConfigured } from "@/lib/push";
import { getSignedUserSession } from "@/lib/user-auth";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `알림 | ${SITE_NAME}`,
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
        <Container className="pb-16 pt-8 sm:pt-10" size="wide">
          <div className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
            <div className="px-1">
              <h1 className="text-base font-semibold text-foreground sm:text-lg">알림</h1>
            </div>
            <NotificationInbox initialState={notificationResult} />
            <section className="space-y-2">
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
