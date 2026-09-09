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
  alreadyExists?: boolean;
};

export type NotificationRecipientAudience = {
  scope: "all" | "year" | "campus" | "member";
  year?: number | null;
  campus?: string | null;
  memberIds?: string[] | null;
};

export type NotificationCampaignClaimDisposition =
  | "claimed"
  | "resumed"
  | "in_progress"
  | "completed";

export type NotificationCampaignClaimInput = Omit<
  NotificationBroadcastInput,
  "idempotencyKey"
> & {
  idempotencyKey: string;
  leaseDurationSeconds: number;
};

export type NotificationCampaignClaimResult = {
  notification: NotificationRecord;
  recipientMemberIds: string[];
  disposition: NotificationCampaignClaimDisposition;
  attemptToken: string | null;
};

export type FinalizeNotificationCampaignInput = {
  notificationId: string;
  attemptToken: string;
  metadata: Record<string, unknown>;
};

export type NotificationDeliveryClaimDisposition =
  | "claimed"
  | "sent"
  | "in_progress"
  | "needs_reconciliation";

export type NotificationDeliveryClaimInput = {
  notificationId: string;
  memberId: string;
  channel: "push";
  provider: "web_push";
  providerCampaignId: string;
  providerIdempotencyKey: string;
  leaseDurationSeconds: number;
};

export type NotificationDeliveryClaimResult = {
  deliveryId: string;
  disposition: NotificationDeliveryClaimDisposition;
};

export type NotificationDeliveryTransition =
  | "sending"
  | "sent"
  | "failed"
  | "needs_reconciliation";

export type TransitionNotificationDeliveryInput = {
  deliveryId: string;
  transition: NotificationDeliveryTransition;
  errorMessage?: string | null;
};

export interface NotificationRepository {
  createNotification(
    input: NotificationBroadcastInput,
  ): Promise<CreateNotificationResult>;
  addNotificationRecipients(
    notificationId: string,
    recipientMemberIds: string[],
  ): Promise<void>;
  addNotificationAudienceRecipients(
    notificationId: string,
    audience: NotificationRecipientAudience,
  ): Promise<number>;
  claimNotificationCampaign(
    input: NotificationCampaignClaimInput,
  ): Promise<NotificationCampaignClaimResult>;
  finalizeNotificationCampaign(
    input: FinalizeNotificationCampaignInput,
  ): Promise<boolean>;
  claimNotificationDelivery(
    input: NotificationDeliveryClaimInput,
  ): Promise<NotificationDeliveryClaimResult>;
  transitionNotificationDelivery(
    input: TransitionNotificationDeliveryInput,
  ): Promise<boolean>;
  updateNotificationMetadata(
    notificationId: string,
    metadata: Record<string, unknown>,
  ): Promise<void>;
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
  markAllMemberNotificationsRead(memberId: string): Promise<number>;
  softDeleteAllMemberNotifications(memberId: string): Promise<number>;
}
