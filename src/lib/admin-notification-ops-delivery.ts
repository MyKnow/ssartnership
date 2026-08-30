import { notificationRepository } from "@/lib/repositories";
import { forEachWithConcurrency } from "@/lib/async-concurrency";
import { buildNotificationPayload } from "@/lib/push/payloads";
import {
  MattermostApiError,
} from "@/lib/mattermost/client";
import {
  MattermostSenderUnavailableError,
  withActiveMattermostSenderForGeneration,
} from "@/lib/mattermost-senders/service";
import {
  absoluteUrl,
} from "@/lib/admin-notification-ops-utils";
import {
  createPushMessageLog,
  finalizePushMessageLog,
  logPushDelivery,
  markPushFailure,
  markPushSuccess,
} from "@/lib/push/logs";
import { buildTrustedPushSubscriptionRequest } from "@/lib/push/subscription-trust";
import { PushError } from "@/lib/push/types";
import type { ResolvedPushAudience, StoredSubscription, WebPushModule } from "@/lib/push/types";
import type {
  AdminNotificationComposerInput,
  AdminNotificationSource,
  AdminNotificationType,
} from "@/lib/admin-notification-ops";
import { getCampaignTemplateKey } from "@/lib/notification-templates/catalog";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";
import {
  mergeNotificationTemplateVariables,
  type NotificationTemplateContext,
} from "@/lib/notification-templates/context";

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
const MATTERMOST_SEND_CONCURRENCY = 4;
const PUSH_SEND_CONCURRENCY = 8;

function createBookkeepingWarning(
  channel: "push" | "mm",
  memberId: string,
) {
  return `${channel === "push" ? "푸시" : "Mattermost"} 발송 기록을 저장하지 못했습니다. (회원 ${memberId})`;
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
      );
      bookkeepingErrors.push(warning);
      console.error(`[admin-notification-ops] ${warning}`, result.reason);
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
  await forEachWithConcurrency(
    input.members,
    MATTERMOST_SEND_CONCURRENCY,
    async (member) => {
      await recordMattermostDelivery({
        notificationId: input.notificationId,
        member,
        status: "failed",
        providerStatus: code,
        errorMessage: getSafeMattermostDeliveryErrorMessage(code),
        bookkeepingErrors: input.bookkeepingErrors,
      });
    },
  );
}

async function sendMattermostCampaignDeliveriesDirect(params: {
  notificationId: string;
  notificationType: AdminNotificationType;
  title: string;
  body: string;
  url?: string | null;
  members: AudienceMember[];
  source: AdminNotificationSource;
  templateContext?: NotificationTemplateContext;
}): Promise<ChannelDeliveryResult> {
  const bookkeepingErrors: string[] = [];
  let sent = 0;
  let failed = 0;
  const template = await resolveNotificationTemplate(
    getCampaignTemplateKey("mattermost", params.notificationType, params.source),
  );
  const categoryLabel = params.notificationType === "marketing" ? "광고" : "공지";
  const templateVariables = mergeNotificationTemplateVariables({
    context: params.templateContext,
    common: {
      categoryLabel,
      title: params.title,
      body: params.body,
      targetLink: params.url ? `\n[바로가기](${absoluteUrl(params.url)})` : "",
    },
  });
  const message = [
    renderNotificationTemplate(template.titleTemplate, templateVariables),
    renderNotificationTemplate(template.bodyTemplate, templateVariables),
  ].filter(Boolean).join("\n");
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
          const outcomes: Array<"sent" | "failed"> = Array(members.length);
          await forEachWithConcurrency(
            members,
            MATTERMOST_SEND_CONCURRENCY,
            async (member, index) => {
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
                outcomes[index] = "sent";
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
                outcomes[index] = "failed";
              }
            },
          );
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
  templateContext?: NotificationTemplateContext;
  resolvedAudience: ResolvedPushAudience;
  subscriptions: StoredSubscription[];
  getWebPush: () => Promise<WebPushModule>;
}): Promise<ChannelDeliveryResult> {
  if (!params.subscriptions.length) {
    return { targeted: 0, sent: 0, failed: 0, skipped: 0, bookkeepingErrors: [] };
  }

  const template = await resolveNotificationTemplate(
    getCampaignTemplateKey("push", params.payload.type, params.source),
  );
  const templateVariables = mergeNotificationTemplateVariables({
    context: params.templateContext,
    common: {
      title: params.payload.title,
      body: params.payload.body,
      targetUrl: params.payload.url,
    },
  });
  const payload = {
    ...params.payload,
    title: renderNotificationTemplate(template.titleTemplate, templateVariables),
    body: renderNotificationTemplate(template.bodyTemplate, templateVariables),
  };
  const messageLog = await createPushMessageLog({
    payload,
    source: params.source,
    audience: params.resolvedAudience,
  });
  const webpush = await params.getWebPush();
  const serialized = buildNotificationPayload(payload);

  let sent = 0;
  let failed = 0;
  const bookkeepingErrors: string[] = [];

  await forEachWithConcurrency(
    params.subscriptions,
    PUSH_SEND_CONCURRENCY,
    async (subscription) => {
      try {
        await webpush.sendNotification(
          await buildTrustedPushSubscriptionRequest({
            endpoint: subscription.endpoint,
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          }),
          serialized,
        );
        sent += 1;
        await runBookkeepingTasks([
          markPushSuccess(subscription.id),
          logPushDelivery({
            messageLogId: messageLog.id,
            memberId: subscription.member_id,
            subscriptionId: subscription.id,
            payload,
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
        const deactivate =
          (error instanceof PushError && error.code === "invalid_request") ||
          statusCode === 404 ||
          statusCode === 410;
        console.error("[admin-notification-ops] push delivery failed", {
          subscriptionId: subscription.id,
          memberId: subscription.member_id,
          error,
        });
        const safeErrorMessage = "푸시 알림 전송에 실패했습니다.";
        await runBookkeepingTasks([
        markPushFailure(
          subscription,
          safeErrorMessage,
          deactivate,
        ),
          logPushDelivery({
            messageLogId: messageLog.id,
            memberId: subscription.member_id,
            subscriptionId: subscription.id,
            payload,
            status: "failed",
            errorMessage: safeErrorMessage,
          }),
          notificationRepository.recordNotificationDelivery({
            notificationId: params.notificationId,
            memberId: subscription.member_id,
            channel: "push",
            status: "failed",
            errorMessage: safeErrorMessage,
          }),
        ], "push", subscription.member_id, bookkeepingErrors);
      }
    },
  );

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
  source?: AdminNotificationSource;
  templateContext?: NotificationTemplateContext;
}): Promise<ChannelDeliveryResult> {
  if (!params.members.length) {
    return { targeted: 0, sent: 0, failed: 0, skipped: 0, bookkeepingErrors: [] };
  }

  return sendMattermostCampaignDeliveriesDirect({
    ...params,
    source: params.source ?? "manual",
  });
}
