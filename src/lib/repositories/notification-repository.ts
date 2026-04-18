import type {
  MemberNotificationRecord,
  NotificationBroadcastInput,
  NotificationDeliveryInput,
  NotificationListResult,
  NotificationRecord,
} from "@/lib/notifications/shared";

export type NotificationListContext = {
  memberId: string;
  offset?: number;
  limit?: number;
};

export type CreateNotificationResult = {
  notification: NotificationRecord;
  recipientMemberIds: string[];
};

export interface NotificationRepository {
  createNotification(
    input: NotificationBroadcastInput,
  ): Promise<CreateNotificationResult>;
  recordNotificationDelivery(input: NotificationDeliveryInput): Promise<void>;
  getUnreadNotificationCount(memberId: string): Promise<number>;
  listMemberNotifications(context: NotificationListContext): Promise<NotificationListResult>;
  getMemberNotification(
    memberId: string,
    notificationId: string,
  ): Promise<MemberNotificationRecord | null>;
  markMemberNotificationRead(
    memberId: string,
    notificationId: string,
  ): Promise<boolean>;
  softDeleteMemberNotification(
    memberId: string,
    notificationId: string,
  ): Promise<boolean>;
}
