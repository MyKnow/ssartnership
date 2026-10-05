// Per-winner delivery bookkeeping for event reward notifications.
//
// The admin notification campaign reports channel totals only, so a partial
// failure used to mark every winner with the same aggregate status and a resend
// went to all winners again. These pure helpers read the per-member
// notification_deliveries rows of every attempt instead, so a resend targets
// only winners who were not reached yet.
import type { EventRewardNotificationSendStatus } from "@/lib/promotions/event-rewards-types";

export const EVENT_REWARD_EXTERNAL_DELIVERY_CHANNELS = ["mm", "push"] as const;

export type EventRewardDeliveryRecord = {
  notificationId: string;
  memberId: string;
  channel: string;
  status: string;
};

export type EventRewardWinnerDeliveryOutcome = "reached" | "unreached";

function isExternalChannel(channel: string) {
  return EVENT_REWARD_EXTERNAL_DELIVERY_CHANNELS.some(
    (candidate) => candidate === channel,
  );
}

/**
 * A winner is reached once any external channel (Mattermost DM or web push)
 * delivered. A winner without any external attempt only had the in-app inbox,
 * which the campaign already wrote, so resending would only duplicate it.
 */
export function resolveEventRewardWinnerDeliveryOutcome(
  records: readonly Pick<EventRewardDeliveryRecord, "channel" | "status">[],
): EventRewardWinnerDeliveryOutcome {
  const external = records.filter((record) => isExternalChannel(record.channel));
  if (external.length === 0) {
    return "reached";
  }
  if (external.some((record) => record.status === "sent")) {
    return "reached";
  }
  if (external.some((record) => record.status === "failed")) {
    return "unreached";
  }
  return "reached";
}

export function summarizeEventRewardWinnerDeliveries(
  memberIds: readonly string[],
  records: readonly EventRewardDeliveryRecord[],
) {
  const byMember = new Map<string, EventRewardDeliveryRecord[]>();
  for (const record of records) {
    const current = byMember.get(record.memberId) ?? [];
    current.push(record);
    byMember.set(record.memberId, current);
  }
  return new Map(
    memberIds.map((memberId) => [
      memberId,
      resolveEventRewardWinnerDeliveryOutcome(byMember.get(memberId) ?? []),
    ]),
  );
}

/** Winners to notify in the next attempt: everyone not reached by an earlier attempt. */
export function selectEventRewardNotificationTargets(
  memberIds: readonly string[],
  previousOutcomes: ReadonlyMap<string, EventRewardWinnerDeliveryOutcome> | null,
) {
  if (!previousOutcomes) {
    return [...memberIds];
  }
  return memberIds.filter((memberId) => previousOutcomes.get(memberId) !== "reached");
}

export function resolveEventRewardDrawDeliveryStatus(
  memberIds: readonly string[],
  outcomes: ReadonlyMap<string, EventRewardWinnerDeliveryOutcome>,
): EventRewardNotificationSendStatus {
  if (memberIds.length === 0) {
    return "failed";
  }
  const reached = memberIds.filter((memberId) => outcomes.get(memberId) === "reached").length;
  if (reached === memberIds.length) {
    return "sent";
  }
  return reached > 0 ? "partial_failed" : "failed";
}

/**
 * Notification ids of every send attempt for a draw. Older draws only kept the
 * latest id in sent_notification_id; newer attempts also append to metadata.
 */
export function getEventRewardNotificationAttemptIds(draw: {
  sent_notification_id: string | null;
  metadata: Record<string, unknown> | null;
}) {
  const recorded = Array.isArray(draw.metadata?.notificationAttemptIds)
    ? draw.metadata.notificationAttemptIds.filter(
        (value): value is string => typeof value === "string" && value.trim() !== "",
      )
    : [];
  const ids = draw.sent_notification_id
    ? [...recorded, draw.sent_notification_id]
    : recorded;
  return Array.from(new Set(ids));
}
