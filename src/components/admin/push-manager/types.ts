import type { PushAudienceScope } from "@/lib/push";
import type {
  AdminNotificationOperationLog,
  AdminNotificationPreview,
  AdminNotificationSendResult,
  AdminNotificationType,
} from "@/lib/admin-notification-ops";
import type { NotificationChannel } from "@/lib/notifications/shared";

export type PartnerOption = {
  id: string;
  name: string;
};

export type MemberOption = {
  id: string;
  display_name: string | null;
  mm_username: string;
  year: number | null;
  campus: string | null;
};

export type AdminPushManagerProps = {
  pushConfigured: boolean;
  mattermostConfigured: boolean;
  partners: PartnerOption[];
  members: MemberOption[];
  recentLogs: AdminNotificationOperationLog[];
  initialTab?: "center" | "logs" | "send";
  automaticSummaries: Array<{
    notificationType: Extract<AdminNotificationType, "new_partner" | "expiring_partner">;
    label: string;
    lastRunAt: string | null;
    recentCount: number;
    failedCount: number;
    failureSamples: string[];
  }>;
};

export type SortOption = "newest" | "oldest" | "delivered" | "failed";

export type AdminPushComposerState = {
  notificationType: AdminNotificationType;
  channels: Record<NotificationChannel, boolean>;
  title: string;
  body: string;
  url: string;
  selectedPartnerId: string;
  audienceScope: PushAudienceScope;
  selectedYear: string;
  selectedCampus: string;
  selectedMemberIds: string[];
  confirmationText: string;
};

export type AdminPushLogFilterState = {
  search: string;
  typeFilter: AdminNotificationType | "all";
  sourceFilter: AdminNotificationOperationLog["source"] | "all";
  statusFilter: AdminNotificationOperationLog["status"] | "all";
  audienceFilter: PushAudienceScope | "all";
  sort: SortOption;
};

export type AdminPushReviewState = {
  preview: AdminNotificationPreview;
  lastSubmittedPayload: string;
  lastSendResult?: AdminNotificationSendResult | null;
};
