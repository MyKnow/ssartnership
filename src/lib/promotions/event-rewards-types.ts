// Event reward domain types shared by server modules and client components.
// Keep this module free of runtime imports so client bundles can import it
// without pulling the server-only reward/notification implementation.
import type { EventConditionKey } from "@/lib/promotions/catalog";

export type EventRewardConditionStatus = "received" | "missing";

export type EventRewardConditionSummary = {
  key: EventConditionKey;
  status: EventRewardConditionStatus;
  earnedTickets: number;
  currentCount?: number;
};

export type EventRewardSummary = {
  authenticated: boolean;
  totalTickets: number;
  conditions: EventRewardConditionSummary[];
};

export type EventRewardMemberPreferences = {
  enabled: boolean;
  mmEnabled: boolean;
  marketingEnabled: boolean;
} | null;

export type EventRewardAdminMemberInput = {
  id: string;
  displayName: string | null;
  mmUsername: string;
  year: number;
  campus: string | null;
  createdAt: string | null;
  preferences: EventRewardMemberPreferences;
  reviewCount: number;
};

export type EventRewardAdminMemberRow = EventRewardAdminMemberInput & {
  totalTickets: number;
  conditions: EventRewardConditionSummary[];
};

export type EventRewardAdminOverview = {
  memberCount: number;
  totalTickets: number;
  reviewCount: number;
  conditionCounts: Record<EventConditionKey, number>;
  members: EventRewardAdminMemberRow[];
};

export type EventRewardBeforeStatus = EventRewardConditionStatus | "unknown";

export type EventRewardComparisonMemberRow = EventRewardAdminMemberRow & {
  existedBeforeEvent: boolean;
  joinedDuringEvent: boolean;
  beforeKnownTickets: number;
  afterTickets: number;
  knownTicketDelta: number;
  beforeConditions: Partial<Record<EventConditionKey, EventRewardBeforeStatus>>;
};

export type EventRewardComparisonOverview = {
  beforeAt: string;
  afterAt: string;
  memberCount: number;
  totalBeforeKnownTickets: number;
  totalAfterTickets: number;
  totalKnownTicketDelta: number;
  members: EventRewardComparisonMemberRow[];
};

export type EventRewardDrawRequest = {
  winnerCount: number;
  seed: string;
  googleFormUrl: string;
};

export type EventRewardDrawPreviewRequest = {
  winnerCount: number;
  seed: string;
};

export type EventRewardValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export type EventRewardDrawWinner = {
  rank: number;
  memberId: string;
  displayName: string | null;
  mmUsername: string;
  year: number;
  campus: string | null;
  ticketCount: number;
};

export type EventRewardDrawPlan = {
  seed: string;
  winnerCount: number;
  candidateCount: number;
  totalTickets: number;
  winners: EventRewardDrawWinner[];
};

export type EventRewardDrawStatus =
  | "draft"
  | "finalized"
  | "sent"
  | "partial_failed"
  | "failed";

export type EventRewardWinnerNotificationStatus =
  | "pending"
  | "sent"
  | "partial_failed"
  | "failed"
  | "skipped";

export type EventRewardStoredWinner = {
  id: string;
  drawId: string;
  eventSlug: string;
  memberId: string;
  rank: number;
  ticketCount: number;
  displayName: string | null;
  mmUsername: string;
  year: number;
  campus: string | null;
  notificationStatus: EventRewardWinnerNotificationStatus;
  notificationSentAt: string | null;
  notificationError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventRewardStoredDraw = {
  id: string;
  eventSlug: string;
  status: EventRewardDrawStatus;
  seed: string;
  winnerCount: number;
  candidateCount: number;
  totalTickets: number;
  googleFormUrl: string;
  guidePath: string;
  sentNotificationId: string | null;
  createdByAdminId: string | null;
  createdAt: string;
  finalizedAt: string | null;
  sentAt: string | null;
  updatedAt: string;
  winners: EventRewardStoredWinner[];
};

export type EventRewardNotificationSendStatus = "sent" | "partial_failed" | "failed";
