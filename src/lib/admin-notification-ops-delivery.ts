import { notificationRepository } from "@/lib/repositories";
import { createDirectChannel, sendPost } from "@/lib/mattermost/channels";
import { loginWithPassword } from "@/lib/mattermost/auth";
import { getSenderCredentials, hasSenderCredentials } from "@/lib/mattermost/config";
import { buildNotificationPayload } from "@/lib/push/payloads";
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
import { buildMattermostMessage, getMattermostSenderCandidateYears } from "@/lib/admin-notification-ops-utils";

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

  const senderSessionByYear = new Map<number, Promise<{ token: string; user: { id: string } }>>();
  let sent = 0;
  let failed = 0;
  const bookkeepingErrors: string[] = [];

  for (const member of params.members) {
    const candidateYears = getMattermostSenderCandidateYears(member);
    if (candidateYears.length === 0) {
      failed += 1;
      await runBookkeepingTasks(
        [
          notificationRepository.recordNotificationDelivery({
            notificationId: params.notificationId,
            memberId: member.id,
            channel: "mm",
            status: "failed",
            errorMessage: "발송 가능한 Mattermost sender 기수를 찾지 못했습니다.",
          }),
        ],
        "mm",
        member.id,
        bookkeepingErrors,
      );
      continue;
    }

    let lastError: Error | null = null;

    for (const year of candidateYears) {
      if (!hasSenderCredentials(year, { allowDefaultFallback: false })) {
        lastError = new Error(`${year}기 Mattermost sender 계정이 설정되지 않았습니다.`);
        continue;
      }

      let sendSucceeded = false;
      try {
        let sessionPromise = senderSessionByYear.get(year);
        if (!sessionPromise) {
          const credentials = getSenderCredentials(year, { allowDefaultFallback: false });
          sessionPromise = loginWithPassword(credentials.loginId, credentials.password);
          senderSessionByYear.set(
            year,
            sessionPromise as Promise<{ token: string; user: { id: string } }>,
          );
        }
        const session = await sessionPromise;
        const channel = await createDirectChannel(session.token, session.user.id, member.mm_user_id);
        await sendPost(
          session.token,
          channel.id,
          buildMattermostMessage({
            notificationType: params.notificationType,
            title: params.title,
            body: params.body,
            url: params.url,
          }),
        );
        sendSucceeded = true;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Mattermost 발송 실패");
      }

      if (!sendSucceeded) {
        continue;
      }

      sent += 1;
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
      lastError = null;
      break;
    }

    if (!lastError) {
      continue;
    }

    failed += 1;
    await runBookkeepingTasks(
      [
        notificationRepository.recordNotificationDelivery({
          notificationId: params.notificationId,
          memberId: member.id,
          channel: "mm",
          status: "failed",
          errorMessage: lastError.message,
        }),
      ],
      "mm",
      member.id,
      bookkeepingErrors,
    );
  }

  return {
    targeted: params.members.length,
    sent,
    failed,
    skipped: 0,
    bookkeepingErrors,
  };
}
