export type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";

export type PushSubscriptionDevice = {
  id: string;
  label: string;
  userAgent: string | null;
  isCurrent: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastSuccessAt: string | null;
};

export type OperationalNotificationDedupeInput = {
  dedupeKey: string;
  audience: "admin" | "partner";
  notificationType: string;
  targetId: string;
};
