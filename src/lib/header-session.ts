import { notificationRepository } from "@/lib/repositories";
import { getSignedUserSession } from "@/lib/user-auth";

export type HeaderSession = {
  userId: string;
  notificationUnreadCount: number;
};

export async function getHeaderSession(
  userId?: string,
): Promise<HeaderSession | null> {
  const session = userId ? { userId } : await getSignedUserSession();
  if (!session?.userId) {
    return null;
  }

  let notificationUnreadCount = 0;
  try {
    notificationUnreadCount = await notificationRepository.getUnreadNotificationCount(
      session.userId,
    );
  } catch {
    notificationUnreadCount = 0;
  }

  return {
    userId: session.userId,
    notificationUnreadCount,
  };
}
