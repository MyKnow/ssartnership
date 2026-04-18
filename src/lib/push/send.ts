import { notificationRepository } from "@/lib/repositories";
import { normalizeNotificationTargetUrl } from "@/lib/notifications/shared";
import { getSupabaseAdminClient } from "../supabase/server.ts";
import { getPushEnv, isPushConfigured, wrapPushDbError } from "./config.ts";
import { getDefaultPushAudience, resolvePushAudience } from "./audience.ts";
import {
  createPushMessageLog,
  finalizePushMessageLog,
  logPushDelivery,
  markPushFailure,
  markPushSuccess,
} from "./logs.ts";
import {
  buildNotificationPayload,
  getPreferenceKey,
  sanitizeNotificationUrl,
} from "./payloads.ts";
import { getActiveSubscriptionPushPreferences } from "./preferences.ts";
import {
  PushError,
} from "./types.ts";
import type {
  DeliveryResult,
  PushPreferenceState,
  PushSendOptions,
  PushPayload,
  StoredSubscription,
  WebPushModule,
} from "./types.ts";

let webPushPromise: Promise<WebPushModule> | null = null;

async function getWebPush() {
  if (!webPushPromise) {
    webPushPromise = import("web-push").then((module) => {
      const { publicKey, privateKey, subject } = getPushEnv();
      module.setVapidDetails(subject, publicKey, privateKey);
      return module;
    });
  }
  return webPushPromise;
}

export async function sendPushToAudience(
  payload: PushPayload,
  options: PushSendOptions = {},
) {
  if (!isPushConfigured()) {
    throw new PushError("config_missing", "Web Push 환경 변수가 설정되지 않았습니다.");
  }

  const resolvedAudience = await resolvePushAudience(
    options.audience ?? getDefaultPushAudience(),
  );

  const messageLog = await createPushMessageLog({
    payload,
    source: options.source ?? "automatic",
    audience: resolvedAudience,
  });

  const supabase = getSupabaseAdminClient();
  let notificationRecipientIds = resolvedAudience.memberIds;
  if (!notificationRecipientIds) {
    const memberQuery = supabase.from("members").select("id");
    const { data: memberRows, error: memberError } =
      resolvedAudience.scope === "year"
        ? await memberQuery.eq("year", resolvedAudience.year)
        : resolvedAudience.scope === "campus"
          ? await memberQuery.eq("campus", resolvedAudience.campus)
          : await memberQuery;

    if (memberError) {
      throw wrapPushDbError(memberError, "알림 수신 대상을 불러오지 못했습니다.");
    }

    notificationRecipientIds = (memberRows ?? []).map((item) => item.id);
  }

  const createdNotification = notificationRecipientIds.length
    ? await notificationRepository.createNotification({
        type: payload.type,
        title: payload.title,
        body: payload.body,
        targetUrl: normalizeNotificationTargetUrl(payload.url) ?? "/notifications",
        metadata: {
          campaignKind: "admin_notification_operation",
          source: options.source ?? "automatic",
          audience: resolvedAudience.scope,
          audienceLabel: resolvedAudience.label,
          audienceYear: resolvedAudience.year,
          audienceCampus: resolvedAudience.campus,
          audienceMemberId: resolvedAudience.memberId,
          notificationType: payload.type,
          selectedChannels: ["in_app", "push"],
          totalAudienceCount: notificationRecipientIds.length,
          destinationLabel: normalizeNotificationTargetUrl(payload.url) ?? "/notifications",
          tag: payload.tag ?? null,
        },
        recipientMemberIds: notificationRecipientIds,
      })
    : null;

  let subscriptionQuery = supabase
    .from("push_subscriptions")
    .select("id,member_id,endpoint,p256dh,auth")
    .eq("is_active", true);

  if (resolvedAudience.memberIds && resolvedAudience.memberIds.length > 0) {
    subscriptionQuery = subscriptionQuery.in("member_id", resolvedAudience.memberIds);
  }

  if (resolvedAudience.memberIds && resolvedAudience.memberIds.length === 0) {
    await finalizePushMessageLog({
      id: messageLog.id,
      targeted: 0,
      delivered: 0,
      failed: 0,
    });
    return { targeted: 0, delivered: 0, failed: 0 } satisfies DeliveryResult;
  }

  const { data: subscriptions, error: subscriptionError } = await subscriptionQuery;

  if (subscriptionError) {
    throw wrapPushDbError(subscriptionError, "Push 구독을 불러오지 못했습니다.");
  }

  const safeSubscriptions = (subscriptions ?? []) as StoredSubscription[];
  if (safeSubscriptions.length === 0) {
    await finalizePushMessageLog({
      id: messageLog.id,
      targeted: 0,
      delivered: 0,
      failed: 0,
    });
    return { targeted: 0, delivered: 0, failed: 0 } satisfies DeliveryResult;
  }

  const memberIds = Array.from(new Set(safeSubscriptions.map((item) => item.member_id)));
  const { data: preferences, error: preferenceError } = await supabase
    .from("push_preferences")
    .select(
      "member_id,enabled,announcement_enabled,new_partner_enabled,expiring_partner_enabled,review_enabled,mm_enabled,marketing_enabled",
    )
    .in("member_id", memberIds);

  if (preferenceError) {
    throw wrapPushDbError(preferenceError, "Push 설정을 불러오지 못했습니다.");
  }

  const preferenceKey = getPreferenceKey(payload.type);
  const preferenceMap = new Map(
    (preferences ?? []).map((item) => [
      item.member_id,
      {
        enabled: item.enabled,
        announcementEnabled: item.announcement_enabled,
        newPartnerEnabled: item.new_partner_enabled,
        expiringPartnerEnabled: item.expiring_partner_enabled,
        reviewEnabled: item.review_enabled,
        mmEnabled: item.mm_enabled,
        marketingEnabled: item.marketing_enabled,
      } satisfies PushPreferenceState,
    ]),
  );

  const targets = safeSubscriptions.filter((subscription) => {
    const preference = getActiveSubscriptionPushPreferences(
      preferenceMap.get(subscription.member_id),
    );
    return Boolean(preference?.enabled && preference[preferenceKey]);
  });

  if (targets.length === 0) {
    await finalizePushMessageLog({
      id: messageLog.id,
      targeted: 0,
      delivered: 0,
      failed: 0,
    });
    return { targeted: 0, delivered: 0, failed: 0 } satisfies DeliveryResult;
  }

  const webpush = await getWebPush();
  const serialized = buildNotificationPayload({
    ...payload,
    url: sanitizeNotificationUrl(payload.url) ?? "/",
  });

  let delivered = 0;
  let failed = 0;

  for (const subscription of targets) {
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
      delivered += 1;
      await Promise.all([
        markPushSuccess(subscription.id),
        logPushDelivery({
          messageLogId: messageLog.id,
          memberId: subscription.member_id,
          subscriptionId: subscription.id,
          payload,
          status: "sent",
        }),
        createdNotification
          ? notificationRepository.recordNotificationDelivery({
              notificationId: createdNotification.notification.id,
              memberId: subscription.member_id,
              channel: "push",
              status: "sent",
            })
          : Promise.resolve(),
      ]);
    } catch (error) {
      failed += 1;
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : null;
      const errorMessage =
        error instanceof Error ? error.message : "푸시 알림 전송에 실패했습니다.";
      const deactivate = statusCode === 404 || statusCode === 410;
      await Promise.all([
        markPushFailure(subscription, errorMessage, deactivate),
        logPushDelivery({
          messageLogId: messageLog.id,
          memberId: subscription.member_id,
          subscriptionId: subscription.id,
          payload,
          status: "failed",
          errorMessage,
        }),
        createdNotification
          ? notificationRepository.recordNotificationDelivery({
              notificationId: createdNotification.notification.id,
              memberId: subscription.member_id,
              channel: "push",
              status: "failed",
              errorMessage,
            })
          : Promise.resolve(),
      ]);
    }
  }

  await finalizePushMessageLog({
    id: messageLog.id,
    targeted: targets.length,
    delivered,
    failed,
  });

  return {
    targeted: targets.length,
    delivered,
    failed,
  } satisfies DeliveryResult;
}
