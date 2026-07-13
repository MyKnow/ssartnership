import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import NotificationsView from "@/components/notifications/NotificationsView";
import { getPolicyDocumentByKind } from "@/lib/policy-documents";
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

  const [notificationResult, pushPreferences, marketingPolicy] = await Promise.all(
    [
      notificationRepository.listMemberNotifications({
        memberId: session.userId,
        offset: 0,
        limit: 10,
      }),
      getMemberNotificationPreferences(session.userId),
      getPolicyDocumentByKind("marketing").catch(() => null),
    ],
  );
  const headerSession = {
    userId: session.userId,
    notificationUnreadCount: notificationResult.unreadCount,
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <NotificationsView
        notifications={notificationResult}
        pushSettings={{
          initialPreferences: pushPreferences,
          configured: isPushConfigured(),
          marketingPolicy,
        }}
      />
    </div>
  );
}
