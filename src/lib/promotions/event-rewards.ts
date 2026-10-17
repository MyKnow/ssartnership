// Public compatibility facade. Data access, pure calculations and notification
// orchestration live in separate modules without changing existing callers.
export {
  buildEventRewardAdminOverview,
  buildEventRewardComparisonOverview,
  calculateEventRewardConditions,
  sumEventRewardTickets,
} from "@/lib/promotions/event-rewards-eligibility";
export {
  createEventRewardCsv,
  createEventRewardComparisonCsv,
} from "@/lib/promotions/event-rewards-csv";
export {
  buildEventRewardDrawAudit,
  canViewEventRewardWinnerForm,
  createEventRewardDrawPlan,
  EVENT_REWARD_DRAW_ALGORITHM,
  EVENT_REWARD_DRAW_EVENT_SLUGS,
  EventRewardSafeError,
  normalizeEventRewardDrawPreviewRequest,
  normalizeEventRewardDrawRequest,
  parseEventRewardDrawPreviewRequest,
  parseEventRewardDrawRequest,
  supportsEventRewardDraw,
} from "@/lib/promotions/event-rewards-draw";

export type * from "@/lib/promotions/event-rewards-types";

export { getEventRewardWinnerGuidePath } from "@/lib/promotions/event-rewards-draw";
export {
  createStoredEventRewardDraw,
  getEventRewardAdminOverview,
  getEventRewardSummary,
  getEventRewardWinnerGuide,
  getLatestEventRewardDrawWithWinners,
  persistEventRewardDraw,
} from "@/lib/promotions/event-rewards-repository";
export {
  buildEventRewardWinnerNotificationInput,
  EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT,
  isEventRewardNotificationSendComplete,
  normalizeEventRewardTestNotificationRequest,
  normalizeEventRewardWinnerNotificationRequest,
  resolveEventRewardNotificationSentAt,
  sendEventRewardWinnerNotifications,
  sendEventRewardWinnerTestNotification,
} from "@/lib/promotions/event-rewards-notifications";
