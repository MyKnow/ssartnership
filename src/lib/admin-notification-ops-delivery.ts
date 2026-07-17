import { notificationRepository } from "@/lib/repositories";
import { buildNotificationPayload } from "@/lib/push/payloads";
import {
  MattermostApiError,
} from "@/lib/mattermost/client";
import {
  MattermostSenderUnavailableError,
  withActiveMattermostSenderForGeneration,
} from "@/lib/mattermost-senders/service";
import { buildMattermostMessage } from "@/lib/admin-notification-ops-utils";
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
  mattermostUserId: string;
  isStaff: boolean;
  sourceYears: number[];
  generation: number;
  senderGeneration: number | null;
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

function toMattermostDeliveryCode(error: unknown) {
  if (error instanceof MattermostSenderUnavailableError) {
    return error.code;
  }
  if (error instanceof MattermostApiError) {
    return error.code;
  }
  return "unavailable";
}

function getSafeMattermostDeliveryErrorMessage(code: string) {
  if (code === "sender_not_configured") {
    return "대상 기수의 Mattermost Sender가 활성화되지 않았습니다.";
  }
  if (code === "configuration_invalid") {
    return "Mattermost Sender 서버 설정을 확인해 주세요.";
  }
  if (code === "not_found") {
    return "Mattermost에서 수신자를 찾지 못했습니다.";
  }
  if (code === "unauthorized" || code === "forbidden") {
    return "Mattermost Sender 권한을 확인해 주세요.";
  }
  if (code === "rate_limited") {
    return "Mattermost 요청 한도로 발송하지 못했습니다.";
  }
  return "Mattermost 발송에 실패했습니다.";
}

async function recordMattermostDelivery(input: {
  notificationId: string;
  member: AudienceMember;
  status: "sent" | "failed";
  providerNotificationId?: string | null;
  providerStatus: string;
  errorMessage?: string | null;
  bookkeepingErrors: string[];
}) {
  await runBookkeepingTasks(
    [
      notificationRepository.recordNotificationDelivery({
        notificationId: input.notificationId,
        memberId: input.member.id,
        channel: "mm",
        status: input.status,
        errorMessage: input.errorMessage ?? null,
        provider: "mattermost",
        providerNotificationId: input.providerNotificationId ?? null,
        providerCampaignId: input.notificationId,
        providerIdempotencyKey: `ssartnership:${input.notificationId}:mm:${input.member.id}`,
        providerStatus: input.providerStatus,
      }),
    ],
    "mm",
    input.member.id,
    input.bookkeepingErrors,
  );
}

async function markGroupMattermostFailure(input: {
  notificationId: string;
  members: AudienceMember[];
  error: unknown;
  bookkeepingErrors: string[];
}) {
  const code = toMattermostDeliveryCode(input.error);
  await Promise.all(input.members.map((member) => recordMattermostDelivery({
    notificationId: input.notificationId,
    member,
    status: "failed",
    providerStatus: code,
    errorMessage: getSafeMattermostDeliveryErrorMessage(code),
    bookkeepingErrors: input.bookkeepingErrors,
  })));
}

async function sendMattermostCampaignDeliveriesDirect(params: {
  notificationId: string;
  notificationType: AdminNotificationType;
  title: string;
  body: string;
  url?: string | null;
  members: AudienceMember[];
}): Promise<ChannelDeliveryResult> {
  const bookkeepingErrors: string[] = [];
  let sent = 0;
  let failed = 0;
  const message = buildMattermostMessage({
    notificationType: params.notificationType,
    title: params.title,
    body: params.body,
    url: params.url,
  });
  const grouped = new Map<number, AudienceMember[]>();
  const withoutSender: AudienceMember[] = [];

  for (const member of params.members) {
    if (member.senderGeneration === null) {
      withoutSender.push(member);
      continue;
    }
    const members = grouped.get(member.senderGeneration) ?? [];
    members.push(member);
    grouped.set(member.senderGeneration, members);
  }

  if (withoutSender.length > 0) {
    failed += withoutSender.length;
    await markGroupMattermostFailure({
      notificationId: params.notificationId,
      members: withoutSender,
      error: new MattermostSenderUnavailableError("sender_not_configured"),
      bookkeepingErrors,
    });
  }

  for (const [generation, members] of grouped) {
    try {
      const outcome = await withActiveMattermostSenderForGeneration(
        generation,
        async (session) => {
          const outcomes = await Promise.all(members.map(async (member) => {
            try {
              const post = await session.sendDirectMessage(member.mattermostUserId, message);
              await recordMattermostDelivery({
                notificationId: params.notificationId,
                member,
                status: "sent",
                providerNotificationId: post.id,
                providerStatus: "sent",
                bookkeepingErrors,
              });
              return "sent" as const;
            } catch (error) {
              const code = toMattermostDeliveryCode(error);
              await recordMattermostDelivery({
                notificationId: params.notificationId,
                member,
                status: "failed",
                providerStatus: code,
                errorMessage: getSafeMattermostDeliveryErrorMessage(code),
                bookkeepingErrors,
              });
              return "failed" as const;
            }
          }));
          return outcomes;
        },
      );
      sent += outcome.filter((status) => status === "sent").length;
      failed += outcome.filter((status) => status === "failed").length;
    } catch (error) {
      failed += members.length;
      await markGroupMattermostFailure({
        notificationId: params.notificationId,
        members,
        error,
        bookkeepingErrors,
      });
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

  return sendMattermostCampaignDeliveriesDirect(params);
}
