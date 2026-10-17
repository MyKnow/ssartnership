import { normalizeNotificationTargetUrl } from "@/lib/notifications/shared";
import { toOperationalTemplateChannel } from "@/lib/notifications/channel";
import { forEachWithConcurrency } from "@/lib/async-concurrency";
import {
  PARTNER_NOTIFICATION_CHANNELS,
  resolvePartnerNotificationChannels,
  type PartnerNotificationChannel,
  type PartnerOperationalNotificationType,
} from "@/lib/partner-notification-routing";
import { sendPartnerOperationalNotificationEmail } from "@/lib/partner-email";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getPartnerOperationalTemplateKey } from "@/lib/notification-templates/catalog";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";
import {
  mergeNotificationTemplateVariables,
  type NotificationTemplateContext,
} from "@/lib/notification-templates/context";
import { logServerError } from "@/lib/server-log";

import { rollbackCreatedOperationalNotification } from "./persistence";
import {
  insertPartnerNotification,
  listPartnerNotificationAccounts,
  insertPartnerRecipients,
  recordPartnerDelivery,
} from "./repository.supabase";
import { sendPartnerPushDeliveries } from "./delivery";

const OPERATIONAL_DELIVERY_CONCURRENCY = 8;
const OPERATIONAL_EMAIL_CONCURRENCY = 4;

function toTargetUrl(value?: string | null, fallback = "/") {
  return normalizeNotificationTargetUrl(value) ?? fallback;
}

export async function createPartnerOperationalNotification(input: {
  type: PartnerOperationalNotificationType;
  companyId: string | null;
  accountIds?: string[];
  title: string;
  body: string;
  targetUrl?: string | null;
  metadata?: Record<string, unknown>;
  requestedChannels?: PartnerNotificationChannel[];
  templateContext?: NotificationTemplateContext;
  templateVariant?: string;
}) {
  const supabase = getSupabaseAdminClient();
  const targetUrl = toTargetUrl(input.targetUrl, "/partner/notifications");
  const inAppTemplate = await resolveNotificationTemplate(
    getPartnerOperationalTemplateKey(
      toOperationalTemplateChannel("portal"),
      input.type,
      input.templateVariant,
    ),
  );
  const inAppVariables = mergeNotificationTemplateVariables({
    context: input.templateContext,
    common: { title: input.title, body: input.body, targetUrl },
  });
  const renderedTitle = renderNotificationTemplate(
    inAppTemplate.titleTemplate,
    inAppVariables,
  );
  const renderedBody = renderNotificationTemplate(
    inAppTemplate.bodyTemplate,
    inAppVariables,
  );
  const notification = await insertPartnerNotification(supabase, {
    company_id: input.companyId,
    type: input.type,
    title: renderedTitle,
    body: renderedBody,
    target_url: targetUrl,
    metadata: input.metadata ?? {},
  });

  let accounts: Array<{
    id: string;
    displayName: string;
    email: string;
    channels: PartnerNotificationChannel[];
  }> = [];
  let recipientRows: Array<{ notification_id: string; account_id: string }> =
    [];
  try {
    const accountRows = await listPartnerNotificationAccounts(supabase, input);

    accounts = (accountRows ?? []).map((row) => {
      return {
        id: String(row.id),
        displayName: row.displayName,
        email: row.email,
        channels: resolvePartnerNotificationChannels({
          type: input.type,
          requestedChannels: input.requestedChannels ?? [
            ...PARTNER_NOTIFICATION_CHANNELS,
          ],
          preferences: row.preferences,
        }),
      };
    });

    recipientRows = accounts
      .filter((account) => account.channels.includes("portal"))
      .map((account) => ({
        notification_id: String(notification.id),
        account_id: account.id,
      }));
    if (recipientRows.length > 0) {
      await insertPartnerRecipients(supabase, recipientRows);
      await forEachWithConcurrency(
        recipientRows,
        OPERATIONAL_DELIVERY_CONCURRENCY,
        async (row) => {
          await recordPartnerDelivery({
            notificationId: String(notification.id),
            accountId: row.account_id,
            channel: "portal",
            status: "sent",
          });
        },
      );
    }
  } catch (error) {
    await rollbackCreatedOperationalNotification({
      supabase,
      audience: "partner",
      notificationId: String(notification.id),
      originalError: error,
    });
    throw error;
  }

  const emailTargets = accounts.filter((account) =>
    account.channels.includes("email"),
  );
  await forEachWithConcurrency(
    emailTargets,
    OPERATIONAL_EMAIL_CONCURRENCY,
    async (account) => {
      try {
        await sendPartnerOperationalNotificationEmail({
          to: account.email,
          displayName: account.displayName,
          title: input.title,
          body: input.body,
          targetUrl,
          notificationType: input.type,
          templateContext: input.templateContext,
          templateVariant: input.templateVariant,
        });
        await recordPartnerDelivery({
          notificationId: notification.id,
          accountId: account.id,
          channel: "email",
          status: "sent",
        });
      } catch (error) {
        await recordPartnerDelivery({
          notificationId: notification.id,
          accountId: account.id,
          channel: "email",
          status: "skipped",
          errorMessage:
            error instanceof Error
              ? error.message
              : "이메일 발송 설정이 없습니다.",
        });
      }
    },
  );

  const pushTargetAccountIds = accounts
    .filter((account) => account.channels.includes("push"))
    .map((account) => account.id);
  if (pushTargetAccountIds.length > 0) {
    try {
      await sendPartnerPushDeliveries({
        notificationId: String(notification.id),
        type: input.type,
        title: input.title,
        body: input.body,
        targetUrl,
        accountIds: pushTargetAccountIds,
        templateContext: input.templateContext,
        templateVariant: input.templateVariant,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "파트너 푸시 발송 준비에 실패했습니다.";
      logServerError("[operational-notifications] partner push preparation failed", errorMessage);
      await forEachWithConcurrency(
        pushTargetAccountIds,
        OPERATIONAL_DELIVERY_CONCURRENCY,
        async (accountId) => {
          await recordPartnerDelivery({
            notificationId: String(notification.id),
            accountId,
            channel: "push",
            status: "failed",
            errorMessage,
          });
        },
      );
    }
  }

  return {
    notificationId: String(notification.id),
    recipientCount: recipientRows.length,
  };
}
