import { toOperationalTemplateChannel } from "@/lib/notifications/channel";
import { forEachWithConcurrency } from "@/lib/async-concurrency";
import { isPushConfigured } from "@/lib/push/config";
import {
  getWebPush,
  sendWebPush,
  shouldDeactivatePushSubscription,
} from "@/lib/push/web-push-client";

import {
  getAdminOperationalTemplateKey,
  getPartnerOperationalTemplateKey,
} from "@/lib/notification-templates/catalog";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";
import {
  mergeNotificationTemplateVariables,
  type NotificationTemplateContext,
} from "@/lib/notification-templates/context";

import {
  recordAdminDelivery,
  recordPartnerDelivery,
  markOperationalPushResult,
  listActivePushSubscriptions,
} from "./repository.supabase";
import type { DeliveryStatus } from "./types";

const OPERATIONAL_PUSH_CONCURRENCY = 8;
const OPERATIONAL_DELIVERY_CONCURRENCY = 8;

function toPushPayload(input: {
  type: string;
  title: string;
  body: string;
  targetUrl: string;
  tag: string;
}) {
  return JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.targetUrl,
    tag: input.tag,
    type: input.type,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  });
}

type OperationalPushAudienceConfig = {
  subscriptionTable: "admin_push_subscriptions" | "partner_push_subscriptions";
  ownerColumn: "admin_id" | "account_id";
  getTemplateKey: (type: string, variant?: string) => string;
  recordDelivery: (input: {
    notificationId: string;
    ownerId: string;
    status: DeliveryStatus;
    errorMessage?: string | null;
  }) => Promise<void>;
};

const ADMIN_OPERATIONAL_PUSH: OperationalPushAudienceConfig = {
  subscriptionTable: "admin_push_subscriptions",
  ownerColumn: "admin_id",
  getTemplateKey: (type, variant) =>
    getAdminOperationalTemplateKey(
      toOperationalTemplateChannel("push"),
      type,
      variant,
    ),
  recordDelivery: ({ ownerId, ...input }) =>
    recordAdminDelivery({ ...input, adminId: ownerId, channel: "push" }),
};

const PARTNER_OPERATIONAL_PUSH: OperationalPushAudienceConfig = {
  subscriptionTable: "partner_push_subscriptions",
  ownerColumn: "account_id",
  getTemplateKey: (type, variant) =>
    getPartnerOperationalTemplateKey(
      toOperationalTemplateChannel("push"),
      type,
      variant,
    ),
  recordDelivery: ({ ownerId, ...input }) =>
    recordPartnerDelivery({ ...input, accountId: ownerId, channel: "push" }),
};

/**
 * 관리자·파트너 운영 알림의 웹 푸시 팬아웃. 대상별 차이(구독 테이블, 소유자
 * 컬럼, 템플릿 키, delivery 기록 테이블)는 config로만 주입하고 동시성·만료
 * 구독 정리·실패 기록 규칙은 이 함수 하나에서 관리한다.
 */
async function sendOperationalPushDeliveries(
  config: OperationalPushAudienceConfig,
  input: {
    notificationId: string;
    type: string;
    title: string;
    body: string;
    targetUrl: string;
    ownerIds: string[];
    templateContext?: NotificationTemplateContext;
    templateVariant?: string;
  },
) {
  if (!isPushConfigured()) {
    await forEachWithConcurrency(
      input.ownerIds,
      OPERATIONAL_DELIVERY_CONCURRENCY,
      async (ownerId) => {
        await config.recordDelivery({
          notificationId: input.notificationId,
          ownerId,
          status: "skipped",
          errorMessage: "Web Push 환경 변수가 설정되지 않았습니다.",
        });
      },
    );
    return;
  }

  const subscriptions = await listActivePushSubscriptions({ ...config, ownerIds: input.ownerIds });
  const template = await resolveNotificationTemplate(
    config.getTemplateKey(input.type, input.templateVariant),
  );
  const templateVariables = mergeNotificationTemplateVariables({
    context: input.templateContext,
    common: {
      title: input.title,
      body: input.body,
      targetUrl: input.targetUrl,
    },
  });
  const renderedTitle = renderNotificationTemplate(
    template.titleTemplate,
    templateVariables,
  );
  const renderedBody = renderNotificationTemplate(
    template.bodyTemplate,
    templateVariables,
  );
  const webpush = await getWebPush();
  const serialized = toPushPayload({
    type: input.type,
    title: renderedTitle,
    body: renderedBody,
    targetUrl: input.targetUrl,
    tag: `${input.type}:${input.notificationId}`,
  });

  await forEachWithConcurrency(
    subscriptions,
    OPERATIONAL_PUSH_CONCURRENCY,
    async (subscription) => {
      const ownerId = subscription.ownerId;
      try {
        await sendWebPush(webpush, subscription, serialized);
        await markOperationalPushResult({
          table: config.subscriptionTable,
          id: subscription.id,
          ok: true,
        });
        await config.recordDelivery({
          notificationId: input.notificationId,
          ownerId,
          status: "sent",
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "푸시 발송 실패";
        await markOperationalPushResult({
          table: config.subscriptionTable,
          id: subscription.id,
          ok: false,
          errorMessage,
          deactivate: shouldDeactivatePushSubscription(error),
        });
        await config.recordDelivery({
          notificationId: input.notificationId,
          ownerId,
          status: "failed",
          errorMessage,
        });
      }
    },
  );
}

export async function sendAdminPushDeliveries(input: {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  targetUrl: string;
  adminIds: string[];
  templateContext?: NotificationTemplateContext;
  templateVariant?: string;
}) {
  const { adminIds, ...rest } = input;
  return sendOperationalPushDeliveries(ADMIN_OPERATIONAL_PUSH, {
    ...rest,
    ownerIds: adminIds,
  });
}

export async function sendPartnerPushDeliveries(input: {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  targetUrl: string;
  accountIds: string[];
  templateContext?: NotificationTemplateContext;
  templateVariant?: string;
}) {
  const { accountIds, ...rest } = input;
  return sendOperationalPushDeliveries(PARTNER_OPERATIONAL_PUSH, {
    ...rest,
    ownerIds: accountIds,
  });
}
