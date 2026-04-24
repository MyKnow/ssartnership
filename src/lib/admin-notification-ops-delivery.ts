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
}) {
  if (!params.subscriptions.length) {
    return { targeted: 0, sent: 0, failed: 0, skipped: 0 };
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
      await Promise.all([
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
      ]);
    } catch (error) {
      failed += 1;
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : null;
      const errorMessage =
        error instanceof Error ? error.message : "푸시 알림 전송에 실패했습니다.";
      await Promise.all([
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
      ]);
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
  };
}

export async function sendMattermostCampaignDeliveries(params: {
  notificationId: string;
  notificationType: AdminNotificationType;
  title: string;
  body: string;
  url?: string | null;
  members: AudienceMember[];
}) {
  if (!params.members.length) {
    return { targeted: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const senderSessionByYear = new Map<number, Promise<{ token: string; user: { id: string } }>>();
  let sent = 0;
  let failed = 0;

  for (const member of params.members) {
    const candidateYears = getMattermostSenderCandidateYears(member);
    if (candidateYears.length === 0) {
      failed += 1;
      await notificationRepository.recordNotificationDelivery({
        notificationId: params.notificationId,
        memberId: member.id,
        channel: "mm",
        status: "failed",
        errorMessage: "발송 가능한 Mattermost sender 기수를 찾지 못했습니다.",
      });
      continue;
    }

    let lastError: Error | null = null;

    for (const year of candidateYears) {
      if (!hasSenderCredentials(year, { allowDefaultFallback: false })) {
        lastError = new Error(`${year}기 Mattermost sender 계정이 설정되지 않았습니다.`);
        continue;
      }

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
        sent += 1;
        await notificationRepository.recordNotificationDelivery({
          notificationId: params.notificationId,
          memberId: member.id,
          channel: "mm",
          status: "sent",
        });
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Mattermost 발송 실패");
      }
    }

    if (!lastError) {
      continue;
    }

    try {
      failed += 1;
      await notificationRepository.recordNotificationDelivery({
        notificationId: params.notificationId,
        memberId: member.id,
        channel: "mm",
        status: "failed",
        errorMessage: lastError.message,
      });
    } catch {
      failed += 1;
    }
  }

  return {
    targeted: params.members.length,
    sent,
    failed,
    skipped: 0,
  };
}
