import { notificationRepository } from "@/lib/repositories";
import { buildNotificationPayload } from "@/lib/push/payloads";
import {
  getSsafyVerifyServerApiConfig,
} from "@/lib/ssafy-verify/config";
import {
  SsafyVerifyServerApiError,
  createSsafyVerifyServerApiClient,
} from "@/lib/ssafy-verify/server-api";
import {
  createPushMessageLog,
  finalizePushMessageLog,
  logPushDelivery,
  markPushFailure,
  markPushSuccess,
} from "@/lib/push/logs";
import type { ResolvedPushAudience, StoredSubscription, WebPushModule } from "@/lib/push/types";
import type {
  AdminNotificationComposerInput,
  AdminNotificationSource,
  AdminNotificationType,
} from "@/lib/admin-notification-ops";

type AudienceMember = {
  id: string;
  mm_user_id: string;
  is_staff: boolean;
  source_years: number[];
  year: number;
};

type ChannelDeliveryResult = {
  targeted: number;
  sent: number;
  failed: number;
  skipped: number;
  bookkeepingErrors: string[];
};

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function createBookkeepingWarning(
  channel: "push" | "mm",
  memberId: string,
  message: string,
) {
  return `[admin-notification-ops] ${channel} bookkeeping failed for member ${memberId}: ${message}`;
}

async function runBookkeepingTasks(
  tasks: Array<Promise<void>>,
  channel: "push" | "mm",
  memberId: string,
  bookkeepingErrors: string[],
) {
  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      const warning = createBookkeepingWarning(
        channel,
        memberId,
        toErrorMessage(result.reason, "알 수 없는 후처리 오류"),
      );
      bookkeepingErrors.push(warning);
      console.error(warning);
    }
  }
}

function chunkMembers<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function toVerifyDeliveryErrorMessage(error: unknown) {
  if (error instanceof SsafyVerifyServerApiError) {
    const requestSuffix = error.requestId ? ` (request_id: ${error.requestId})` : "";
    return `${error.errorCode}: ${error.message}${requestSuffix}`;
  }
  return toErrorMessage(error, "SSAFY Verify Mattermost 알림 위임 실패");
}

function isVerifyDeliveryAccepted(status: string) {
  return status !== "failed";
}

async function sendMattermostCampaignDeliveriesViaVerify(params: {
  notificationId: string;
  notificationType: AdminNotificationType;
  title: string;
  body: string;
  url?: string | null;
  members: AudienceMember[];
}): Promise<ChannelDeliveryResult> {
  const client = createSsafyVerifyServerApiClient(getSsafyVerifyServerApiConfig());
  let sent = 0;
  let failed = 0;
  const bookkeepingErrors: string[] = [];
  const chunks = chunkMembers(params.members, 25);

  for (const [chunkIndex, members] of chunks.entries()) {
    try {
      const result = await client.sendMattermostNotificationBatch({
        campaignId: params.notificationId,
        purpose: params.notificationType,
        templateKey: "ssartnership_admin_notification",
        message: {
          title: params.title,
          body: params.body,
          url: params.url ?? undefined,
        },
        recipients: members.map((member) => ({
          mattermostUserId: member.mm_user_id,
        })),
        idempotencyKey: `ssartnership:${params.notificationId}:mm:${chunkIndex + 1}`,
      });

      if (!isVerifyDeliveryAccepted(result.status)) {
        const errorMessage = `SSAFY Verify Mattermost 알림 상태: ${result.status}`;
        failed += members.length;
        for (const member of members) {
          await runBookkeepingTasks(
            [
              notificationRepository.recordNotificationDelivery({
                notificationId: params.notificationId,
                memberId: member.id,
                channel: "mm",
                status: "failed",
                errorMessage,
              }),
            ],
            "mm",
            member.id,
            bookkeepingErrors,
          );
        }
        continue;
      }

      sent += members.length;
      for (const member of members) {
        await runBookkeepingTasks(
          [
            notificationRepository.recordNotificationDelivery({
              notificationId: params.notificationId,
              memberId: member.id,
              channel: "mm",
              status: "sent",
            }),
          ],
          "mm",
          member.id,
          bookkeepingErrors,
        );
      }
    } catch (error) {
      const errorMessage = toVerifyDeliveryErrorMessage(error);
      failed += members.length;
      for (const member of members) {
        await runBookkeepingTasks(
          [
            notificationRepository.recordNotificationDelivery({
              notificationId: params.notificationId,
              memberId: member.id,
              channel: "mm",
              status: "failed",
              errorMessage,
            }),
          ],
          "mm",
          member.id,
          bookkeepingErrors,
        );
      }
    }
  }

  return {
    targeted: params.members.length,
    sent,
    failed,
    skipped: 0,
    bookkeepingErrors,
  };
}

export async function sendPushCampaignDeliveries(params: {
  notificationId: string;
  payload: {
    type: AdminNotificationComposerInput["notificationType"];
    title: string;
    body: string;
    url: string;
    tag: string;
  };
  source: AdminNotificationSource;
  resolvedAudience: ResolvedPushAudience;
  subscriptions: StoredSubscription[];
  getWebPush: () => Promise<WebPushModule>;
}): Promise<ChannelDeliveryResult> {
  if (!params.subscriptions.length) {
    return { targeted: 0, sent: 0, failed: 0, skipped: 0, bookkeepingErrors: [] };
  }

  const messageLog = await createPushMessageLog({
    payload: params.payload,
    source: params.source,
    audience: params.resolvedAudience,
  });
  const webpush = await params.getWebPush();
  const serialized = buildNotificationPayload(params.payload);

  let sent = 0;
  let failed = 0;
  const bookkeepingErrors: string[] = [];

  for (const subscription of params.subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          expirationTime: null,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        serialized,
      );
      sent += 1;
      await runBookkeepingTasks([
        markPushSuccess(subscription.id),
        logPushDelivery({
          messageLogId: messageLog.id,
          memberId: subscription.member_id,
          subscriptionId: subscription.id,
          payload: params.payload,
          status: "sent",
        }),
        notificationRepository.recordNotificationDelivery({
          notificationId: params.notificationId,
          memberId: subscription.member_id,
          channel: "push",
          status: "sent",
        }),
      ], "push", subscription.member_id, bookkeepingErrors);
    } catch (error) {
      failed += 1;
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : null;
      const errorMessage =
        error instanceof Error ? error.message : "푸시 알림 전송에 실패했습니다.";
      await runBookkeepingTasks([
        markPushFailure(subscription, errorMessage, statusCode === 404 || statusCode === 410),
        logPushDelivery({
          messageLogId: messageLog.id,
          memberId: subscription.member_id,
          subscriptionId: subscription.id,
          payload: params.payload,
          status: "failed",
          errorMessage,
        }),
        notificationRepository.recordNotificationDelivery({
          notificationId: params.notificationId,
          memberId: subscription.member_id,
          channel: "push",
          status: "failed",
          errorMessage,
        }),
      ], "push", subscription.member_id, bookkeepingErrors);
    }
  }

  await finalizePushMessageLog({
    id: messageLog.id,
    targeted: params.subscriptions.length,
    delivered: sent,
    failed,
  });

  return {
    targeted: params.subscriptions.length,
    sent,
    failed,
    skipped: 0,
    bookkeepingErrors,
  };
}

export async function sendMattermostCampaignDeliveries(params: {
  notificationId: string;
  notificationType: AdminNotificationType;
  title: string;
  body: string;
  url?: string | null;
  members: AudienceMember[];
}): Promise<ChannelDeliveryResult> {
  if (!params.members.length) {
    return { targeted: 0, sent: 0, failed: 0, skipped: 0, bookkeepingErrors: [] };
  }

  return sendMattermostCampaignDeliveriesViaVerify(params);
}
