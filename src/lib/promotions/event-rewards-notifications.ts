import {
  sendAdminNotificationCampaign,
  type AdminNotificationComposerInput,
} from "@/lib/admin-notification-ops";
import {
  getEventRewardNotificationAttemptIds,
  resolveEventRewardDrawDeliveryStatus,
  summarizeEventRewardWinnerDeliveries,
} from "@/lib/promotions/event-reward-delivery";
import {
  EventRewardSafeError,
  getEventRewardWinnerGuidePath,
  requireEventRewardSlug,
} from "@/lib/promotions/event-rewards-draw";
import { getEventRewardNotificationRepository } from "@/lib/promotions/event-rewards-repository";
import type {
  EventRewardDrawStatus,
  EventRewardNotificationSendStatus,
} from "@/lib/promotions/event-rewards-types";

export const EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT = "알림 발송";

export function normalizeEventRewardWinnerNotificationRequest(input: {
  confirmationText?: unknown;
}) {
  const confirmationText =
    typeof input.confirmationText === "string" ? input.confirmationText.trim() : "";
  if (confirmationText !== EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT) {
    throw new EventRewardSafeError(
      `확인 문구 '${EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT}'를 정확히 입력해 주세요.`,
    );
  }
  return { confirmationText };
}

export function normalizeEventRewardTestNotificationRequest(input: {
  memberId?: unknown;
}) {
  const memberId = typeof input.memberId === "string" ? input.memberId.trim() : "";
  if (!memberId) {
    throw new EventRewardSafeError("테스트 수신자를 선택해 주세요.");
  }
  return { memberId };
}

function drawNotificationStatus(params: {
  targeted: number;
  sent: number;
  failed: number;
}): EventRewardNotificationSendStatus {
  if (params.targeted === 0) {
    return "failed";
  }
  if (params.sent === 0) {
    return "failed";
  }
  if (params.failed > 0 || params.sent < params.targeted) {
    return "partial_failed";
  }
  return "sent";
}

export function resolveEventRewardNotificationSentAt(
  status: EventRewardNotificationSendStatus,
  attemptedAt: string,
) {
  return status === "sent" ? attemptedAt : null;
}

export function isEventRewardNotificationSendComplete(
  status: EventRewardDrawStatus,
  sentAt: string | null,
) {
  return status === "sent" && Boolean(sentAt);
}

export function buildEventRewardWinnerNotificationInput(params: {
  guidePath: string;
  memberIds: readonly string[];
  confirmationText: string;
  testMode?: boolean;
}): AdminNotificationComposerInput {
  const memberIds = Array.from(
    new Set(params.memberIds.map((memberId) => memberId.trim()).filter(Boolean)),
  );
  if (memberIds.length === 0) {
    throw new EventRewardSafeError("발송 대상 당첨자를 찾을 수 없습니다.");
  }

  const title = params.testMode
    ? "[테스트] 싸트너십 추첨권 이벤트 당첨 안내"
    : "싸트너십 추첨권 이벤트 당첨 안내";
  const body = params.testMode
    ? "운영 테스트 발송입니다. 실제 당첨 안내가 아니며, 구글폼은 로그인한 당첨자에게만 노출됩니다."
    : "축하합니다. 기프티콘 발송 정보 입력을 위해 당첨 안내 페이지에서 구글폼을 확인해 주세요.";

  return {
    notificationType: "announcement",
    title,
    body,
    url: params.guidePath,
    audience: {
      scope: "member",
      memberIds,
    },
    channels: {
      in_app: true,
      push: true,
      mm: true,
    },
    confirmationText: params.confirmationText,
  };
}

export async function sendEventRewardWinnerNotifications(
  drawId: string,
  input: { confirmationText?: unknown; eventSlug: string },
) {
  const eventSlug = requireEventRewardSlug(input.eventSlug);
  const request = normalizeEventRewardWinnerNotificationRequest(input);
  const repository = await getEventRewardNotificationRepository(
    drawId,
    eventSlug,
  );
  const { draw } = repository;
  if (
    isEventRewardNotificationSendComplete(
      draw.status,
      draw.sentAt,
    )
  ) {
    throw new EventRewardSafeError("이미 당첨 안내를 발송했습니다.");
  }

  const memberIds = await repository.getWinnerMemberIds();
  if (memberIds.length === 0) {
    throw new EventRewardSafeError("당첨자가 없습니다.");
  }

  const previousAttemptIds = getEventRewardNotificationAttemptIds({
    sent_notification_id: draw.sentNotificationId,
    metadata: draw.metadata,
  });
  const stableNotificationId = typeof draw.metadata?.notificationCampaignId === "string"
    ? draw.metadata.notificationCampaignId : null;
  const attemptedAt = new Date().toISOString();
  const readEvidence = async (ids: string[]) => {
    const records = await repository.fetchDeliveryRecords(ids, memberIds);
    if (!records) throw new EventRewardSafeError(
      "발송 이력을 확인하지 못해 중단했습니다. 발송 결과를 확인한 후 다시 시도해 주세요.",
    );
    return records;
  };
  const previousRecords = await readEvidence(previousAttemptIds);
  const previousOutcomes = summarizeEventRewardWinnerDeliveries(memberIds, previousRecords);
  const legacyIds = previousAttemptIds.filter((id) => id !== stableNotificationId);
  const legacyOutcomes = summarizeEventRewardWinnerDeliveries(
    memberIds, previousRecords
      .filter((record) => legacyIds.includes(record.notificationId))
      // Old push marked arbitrary provider errors "failed"; that legacy marker
      // cannot establish definitive rejection under the new retry contract.
      .map((record) => record.providerStatus === "failed"
        ? { ...record, providerStatus: null } : record),
  );
  // A missing legacy receipt cannot prove that the old, unclaimed sender never posted.
  const legacyUncertain = (memberId: string) => legacyIds.length > 0 && (
    !previousRecords.some((record) => record.memberId === memberId && legacyIds.includes(record.notificationId))
    || ["needs_reconciliation", "pending"].includes(legacyOutcomes.get(memberId) ?? "")
  );
  // A newly attached inbox can precede external delivery in a live campaign.
  // Recover its campaign disposition before treating inbox-only as complete.
  const stableInboxOnly = (memberId: string) => Boolean(stableNotificationId)
    && previousRecords.some((record) => record.memberId === memberId
      && record.notificationId === stableNotificationId && record.channel === "in_app" && record.status === "sent")
    && !previousRecords.some((record) => record.memberId === memberId && record.channel !== "in_app");
  const targetMemberIds = memberIds.filter((memberId) =>
    (previousOutcomes.get(memberId) !== "reached" || stableInboxOnly(memberId))
    && previousOutcomes.get(memberId) !== "needs_reconciliation"
    && !legacyUncertain(memberId),
  );
  let associationToken: string | null = null;
  let associationMetadata = { ...(draw.metadata ?? {}) };
  let attemptIds = previousAttemptIds;
  let targetCount = 0;
  let outcomes = previousOutcomes;

  const persistOutcome = async (notificationId: string | null, channelResults: unknown, warnings: string[]) => {
    const status = resolveEventRewardDrawDeliveryStatus(memberIds, outcomes);
    const sentAt = resolveEventRewardNotificationSentAt(status, attemptedAt);
    // Keep the terminal draw marker until last so a failed winner summary can
    // be repaired from delivery evidence without another provider call.
    for (const outcome of ["reached", "unreached", "pending", "needs_reconciliation"] as const) {
      await repository.updateWinnerNotificationRows(
        memberIds.filter((id) => outcomes.get(id) === outcome), {
          status: outcome === "reached" ? "sent" : outcome === "unreached" ? "failed" : "pending",
          sentAt: outcome === "reached" ? attemptedAt : null,
          error: outcome === "reached" ? null : outcome === "unreached"
            ? "안내 도달을 확인하지 못했습니다. 알림 설정과 발송 결과를 확인해 주세요."
            : "발송 결과 확인이 필요하여 자동 재발송을 중단했습니다.",
        },
      );
    }
    await repository.persistNotificationOutcome({
      status, sentAt, notificationId,
      metadata: {
        ...associationMetadata, channelResults, warnings,
        notificationAttemptIds: attemptIds,
        lastNotificationAttemptedAt: attemptedAt,
        lastNotificationTargetCount: targetCount,
      },
      associationToken,
    });
    return status;
  };

  if (targetMemberIds.length === 0) {
    if (resolveEventRewardDrawDeliveryStatus(memberIds, previousOutcomes) !== "sent") {
      throw new EventRewardSafeError("발송 중이거나 결과 확인이 필요한 안내가 있어 재발송을 중단했습니다.");
    }
    const warnings = ["모든 당첨자에게 이미 안내가 전달되어 추가로 발송하지 않았습니다."];
    const status = await persistOutcome(draw.sentNotificationId, null, warnings);
    return { status, notificationId: draw.sentNotificationId, channelResults: null, warnings };
  }

  const result = await sendAdminNotificationCampaign(
    buildEventRewardWinnerNotificationInput({
      guidePath: draw.guidePath, memberIds: targetMemberIds,
      confirmationText: request.confirmationText,
    }),
    "manual",
    {
      drawId, eventSlug,
      beforeDelivery: async (claim) => {
        attemptIds = Array.from(new Set([...previousAttemptIds, claim.notificationId]));
        const records = await readEvidence(attemptIds);
        // The claim has just attached inbox receipts. They are not evidence that
        // the external portion of this pending attempt already ran.
        const externalOutcomes = summarizeEventRewardWinnerDeliveries(
          targetMemberIds, records.filter((record) => record.channel !== "in_app"),
        );
        const deliveryTargets = targetMemberIds.filter((id) =>
          ["unreached", "pending"].includes(externalOutcomes.get(id) ?? "unreached"),
        );
        associationToken = claim.attemptToken ?? `completed:${claim.notificationId}`;
        associationMetadata = {
          ...associationMetadata, notificationAttemptIds: attemptIds,
          notificationCampaignId: claim.notificationId,
          notificationCampaignAttemptToken: associationToken,
        };
        await repository.associateNotificationCampaign({
          notificationId: claim.notificationId, metadata: associationMetadata,
          attemptedAt,
        });
        targetCount = deliveryTargets.length;
        return deliveryTargets;
      },
      resolveDeliveryStatus: async (notificationId) => {
        outcomes = summarizeEventRewardWinnerDeliveries(memberIds, await readEvidence(
          Array.from(new Set([...attemptIds, notificationId])),
        ));
        return resolveEventRewardDrawDeliveryStatus(memberIds, outcomes);
      },
    },
  );
  if (result.campaignDisposition === "in_progress") {
    throw new EventRewardSafeError("같은 당첨 안내 발송이 이미 진행 중입니다. 잠시 후 결과를 확인해 주세요.");
  }
  outcomes = summarizeEventRewardWinnerDeliveries(memberIds, await readEvidence(attemptIds));
  const warnings = [...result.warnings];
  if ([...outcomes.values()].some((outcome) => outcome === "pending" || outcome === "needs_reconciliation")) {
    warnings.push("발송 결과 확인이 필요한 대상은 자동으로 재발송하지 않습니다.");
  }
  const status = await persistOutcome(result.notificationId, result.channelResults, warnings);
  return { status, notificationId: result.notificationId, channelResults: result.channelResults, warnings };
}

export async function sendEventRewardWinnerTestNotification(
  drawId: string | null,
  input: { memberId?: unknown; eventSlug: string },
) {
  const eventSlug = requireEventRewardSlug(input.eventSlug);
  const request = normalizeEventRewardTestNotificationRequest(input);
  const guidePath = drawId
    ? (
        await getEventRewardNotificationRepository(
          drawId,
          eventSlug,
        )
      ).draw.guidePath
    : getEventRewardWinnerGuidePath(eventSlug);

  const result = await sendAdminNotificationCampaign(
    buildEventRewardWinnerNotificationInput({
      guidePath,
      memberIds: [request.memberId],
      confirmationText: EVENT_REWARD_WINNER_NOTIFICATION_CONFIRMATION_TEXT,
      testMode: true,
    }),
  );

  return {
    status: drawNotificationStatus(
      Object.values(result.channelResults).reduce(
        (accumulator, channel) => ({
          targeted: accumulator.targeted + channel.targeted,
          sent: accumulator.sent + channel.sent,
          failed: accumulator.failed + channel.failed,
        }),
        { targeted: 0, sent: 0, failed: 0 },
      ),
    ),
    notificationId: result.notificationId,
    channelResults: result.channelResults,
    warnings: result.warnings,
  };
}
