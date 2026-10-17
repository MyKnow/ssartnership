import { normalizeNotificationTargetUrl } from "@/lib/notifications/shared";
import { toOperationalTemplateChannel } from "@/lib/notifications/channel";
import { forEachWithConcurrency } from "@/lib/async-concurrency";
import { listAdminAccounts } from "@/lib/admin-accounts";
import { canAdmin } from "@/lib/admin-permissions";

import {
  ADMIN_NOTIFICATION_CHANNELS,
  resolveAdminNotificationChannels,
  type AdminNotificationChannel,
  type AdminOperationalNotificationType,
} from "@/lib/partner-notification-routing";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getAdminOperationalTemplateKey } from "@/lib/notification-templates/catalog";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";
import {
  mergeNotificationTemplateVariables,
  type NotificationTemplateContext,
} from "@/lib/notification-templates/context";
import { logServerError } from "@/lib/server-log";

import { rollbackCreatedOperationalNotification } from "./persistence";
import {
  insertAdminNotification,
  listAdminNotificationPreferences,
  insertAdminRecipients,
  recordAdminDelivery,
} from "./repository.supabase";
import { sendAdminPushDeliveries } from "./delivery";

const OPERATIONAL_DELIVERY_CONCURRENCY = 8;

function toTargetUrl(value?: string | null, fallback = "/") {
  return normalizeNotificationTargetUrl(value) ?? fallback;
}

export async function createAdminOperationalNotification(input: {
  type: AdminOperationalNotificationType;
  title: string;
  body: string;
  targetUrl?: string | null;
  metadata?: Record<string, unknown>;
  requestedChannels?: AdminNotificationChannel[];
  templateContext?: NotificationTemplateContext;
  templateVariant?: string;
}) {
  const supabase = getSupabaseAdminClient();
  const targetUrl = toTargetUrl(input.targetUrl, "/admin/notifications");
  const inAppTemplate = await resolveNotificationTemplate(
    getAdminOperationalTemplateKey(
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
  const notification = await insertAdminNotification(supabase, {
    type: input.type,
    title: renderedTitle,
    body: renderedBody,
    target_url: targetUrl,
    metadata: input.metadata ?? {},
  });

  let recipientRows: Array<{ notification_id: string; admin_id: string }> = [];
  let pushTargetAdminIds: string[] = [];
  try {
    const adminIds = Array.from(
      new Set(
        (await listAdminAccounts())
          .filter(
            (account) =>
              account.isActive &&
              canAdmin(account.permissions, "notifications", "read"),
          )
          .map((account) => account.id),
      ),
    );
    const preferenceRows = await listAdminNotificationPreferences(supabase, adminIds);

    const preferenceByAdminId = new Map(
      (preferenceRows ?? []).map((preference) => [
        preference.adminId,
        preference.preferences,
      ]),
    );
    const admins = adminIds.map((adminId) => ({
      id: adminId,
      channels: resolveAdminNotificationChannels({
        type: input.type,
        requestedChannels: input.requestedChannels ?? [
          ...ADMIN_NOTIFICATION_CHANNELS,
        ],
        preferences: preferenceByAdminId.get(adminId),
      }),
    }));

    recipientRows = admins
      .filter((admin) => admin.channels.includes("portal"))
      .map((admin) => ({
        notification_id: String(notification.id),
        admin_id: admin.id,
      }));
    if (recipientRows.length > 0) {
      await insertAdminRecipients(supabase, recipientRows);
      await forEachWithConcurrency(
        recipientRows,
        OPERATIONAL_DELIVERY_CONCURRENCY,
        async (row) => {
          await recordAdminDelivery({
            notificationId: String(notification.id),
            adminId: row.admin_id,
            channel: "portal",
            status: "sent",
          });
        },
      );
    }

    pushTargetAdminIds = admins
      .filter((admin) => admin.channels.includes("push"))
      .map((admin) => admin.id);
  } catch (error) {
    await rollbackCreatedOperationalNotification({
      supabase,
      audience: "admin",
      notificationId: String(notification.id),
      originalError: error,
    });
    throw error;
  }

  if (pushTargetAdminIds.length > 0) {
    try {
      await sendAdminPushDeliveries({
        notificationId: String(notification.id),
        type: input.type,
        title: input.title,
        body: input.body,
        targetUrl,
        adminIds: pushTargetAdminIds,
        templateContext: input.templateContext,
        templateVariant: input.templateVariant,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "관리자 푸시 발송 준비에 실패했습니다.";
      logServerError("[operational-notifications] admin push preparation failed", errorMessage);
      await forEachWithConcurrency(
        pushTargetAdminIds,
        OPERATIONAL_DELIVERY_CONCURRENCY,
        async (adminId) => {
          await recordAdminDelivery({
            notificationId: String(notification.id),
            adminId,
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
