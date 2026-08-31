import { notificationRepository } from "@/lib/repositories";
import { normalizeNotificationTargetUrl } from "@/lib/notifications/shared";
import { getCampaignTemplateKey } from "@/lib/notification-templates/catalog";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";
import { getSupabaseAdminClient } from "../supabase/server.ts";
import {
  DEFAULT_SUPABASE_IN_FILTER_CHUNK_SIZE,
  collectPagedRowsByFilterChunks,
  collectRowsByFilterChunks,
} from "../supabase/paging.ts";
import { forEachWithConcurrency } from "../async-concurrency.ts";
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
import { buildTrustedPushSubscriptionRequest } from "./subscription-trust.ts";
import {
  PushError,
} from "./types.ts";
import type {
  DeliveryResult,
  PushPreferenceState,
  PushSendOptions,
  PushPayload,
  ResolvedPushAudience,
  StoredSubscription,
  WebPushModule,
} from "./types.ts";

let webPushPromise: Promise<WebPushModule> | null = null;
const PUSH_SEND_CONCURRENCY = 8;
const PUSH_AUDIENCE_PAGE_SIZE = DEFAULT_SUPABASE_IN_FILTER_CHUNK_SIZE;

type PushPreferenceRow = {
  member_id: string;
  enabled: boolean;
  announcement_enabled: boolean;
  new_partner_enabled: boolean;
  expiring_partner_enabled: boolean;
  review_enabled: boolean;
  mm_enabled: boolean;
  marketing_enabled: boolean;
};

async function countAudienceMembers(audience: ResolvedPushAudience) {
  if (audience.scope === "member" && audience.memberIds) {
    return audience.memberIds.length;
  }
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("members")
    .select("id", { count: "exact", head: true });
  if (audience.scope === "year" && audience.year !== null) {
    query = query.eq("generation", audience.year);
  }
  if (audience.scope === "campus" && audience.campus !== null) {
    query = query.eq("campus", audience.campus);
  }
  const { error, count } = await query;
  if (error) {
    throw wrapPushDbError(error, "알림 수신 대상을 불러오지 못했습니다.");
  }
  if (count === null) {
    throw new PushError("db_error", "알림 수신 대상 수를 확인하지 못했습니다.");
  }
  return count;
}

async function listNotificationRecipientPage(
  notificationId: string,
  afterMemberId: string | null,
) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("member_notifications")
    .select("member_id")
    .eq("notification_id", notificationId);
  if (afterMemberId) {
    query = query.gt("member_id", afterMemberId);
  }
  const { data, error } = await query
    .order("member_id", { ascending: true })
    .limit(PUSH_AUDIENCE_PAGE_SIZE);
  if (error) {
    throw wrapPushDbError(error, "알림 수신 대상을 불러오지 못했습니다.");
  }
  return ((data ?? []) as Array<{ member_id: string }>).map(
    (row) => row.member_id,
  );
}

async function listAudiencePushSubscriptions(memberIds: string[]) {
  const supabase = getSupabaseAdminClient();
  if (memberIds.length === 0) {
    return [];
  }

  const result = await collectPagedRowsByFilterChunks<string, StoredSubscription>(
    memberIds,
    async (memberIdChunk, from, to) => {
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id,member_id,endpoint,p256dh,auth")
        .eq("is_active", true)
        .in("member_id", [...memberIdChunk])
        .order("id", { ascending: true })
        .range(from, to);
      if (error) {
        throw wrapPushDbError(error, "Push 구독을 불러오지 못했습니다.");
      }
      return { rows: (data ?? []) as StoredSubscription[], error: false };
    },
  );
  return result.rows;
}

async function listPushPreferences(memberIds: string[]) {
  const supabase = getSupabaseAdminClient();
  const result = await collectRowsByFilterChunks<string, PushPreferenceRow>(
    memberIds,
    async (memberIdChunk) => {
      const { data, error } = await supabase
        .from("push_preferences")
        .select(
          "member_id,enabled,announcement_enabled,new_partner_enabled,expiring_partner_enabled,review_enabled,mm_enabled,marketing_enabled",
        )
        .in("member_id", [...memberIdChunk]);
      if (error) {
        throw wrapPushDbError(error, "Push 설정을 불러오지 못했습니다.");
      }
      return { rows: (data ?? []) as PushPreferenceRow[], error: false };
    },
  );
  return result.rows;
}

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

async function settlePushBookkeeping(
  tasks: Array<Promise<unknown>>,
  phase: "sent" | "failed",
) {
  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status !== "rejected") {
      continue;
    }
    console.error(
      `[push] ${phase} delivery bookkeeping failed`,
      result.reason instanceof Error ? result.reason.message : "unknown_error",
    );
  }
}

export async function sendPushToAudience(
  rawPayload: PushPayload,
  options: PushSendOptions = {},
) {
  if (!isPushConfigured()) {
    throw new PushError("config_missing", "Web Push 환경 변수가 설정되지 않았습니다.");
  }

  const template = await resolveNotificationTemplate(
    getCampaignTemplateKey("push", rawPayload.type),
  );
  const inAppTemplate = await resolveNotificationTemplate(
    getCampaignTemplateKey("in_app", rawPayload.type),
  );
  const templateVariables = {
    title: rawPayload.title,
    body: rawPayload.body,
    targetUrl: rawPayload.url ?? "/notifications",
  };
  const payload: PushPayload = {
    ...rawPayload,
    title: renderNotificationTemplate(template.titleTemplate, templateVariables),
    body: renderNotificationTemplate(template.bodyTemplate, templateVariables),
  };
  const renderedInAppTitle = renderNotificationTemplate(
    inAppTemplate.titleTemplate,
    templateVariables,
  );
  const renderedInAppBody = renderNotificationTemplate(
    inAppTemplate.bodyTemplate,
    templateVariables,
  );

  const resolvedAudience = await resolvePushAudience(
    options.audience ?? getDefaultPushAudience(),
    { materializeMemberIds: false },
  );

  const messageLog = await createPushMessageLog({
    payload,
    source: options.source ?? "automatic",
    audience: resolvedAudience,
  });

  const totalAudienceCount = await countAudienceMembers(resolvedAudience);
  if (totalAudienceCount === 0) {
    await finalizePushMessageLog({
      id: messageLog.id,
      targeted: 0,
      delivered: 0,
      failed: 0,
    });
    return { targeted: 0, delivered: 0, failed: 0 } satisfies DeliveryResult;
  }

  const notificationMetadata = {
    campaignKind: "admin_notification_operation",
    source: options.source ?? "automatic",
    audience: resolvedAudience.scope,
    audienceLabel: resolvedAudience.label,
    audienceYear: resolvedAudience.year,
    audienceCampus: resolvedAudience.campus,
    audienceMemberId: resolvedAudience.memberId,
    notificationType: payload.type,
    selectedChannels: ["in_app", "push"],
    totalAudienceCount,
    destinationLabel: normalizeNotificationTargetUrl(payload.url) ?? "/notifications",
    tag: payload.tag ?? null,
  };
  const createdNotification = await notificationRepository.createNotification({
    type: payload.type,
    title: renderedInAppTitle,
    body: renderedInAppBody,
    targetUrl: normalizeNotificationTargetUrl(payload.url) ?? "/notifications",
    metadata: notificationMetadata,
    recipientMemberIds: [],
  });

  const attachedAudienceCount =
    await notificationRepository.addNotificationAudienceRecipients(
      createdNotification.notification.id,
      {
        scope: resolvedAudience.scope,
        year: resolvedAudience.year,
        campus: resolvedAudience.campus,
        memberIds: resolvedAudience.memberIds,
      },
    );
  if (attachedAudienceCount !== totalAudienceCount) {
    await notificationRepository.updateNotificationMetadata(
      createdNotification.notification.id,
      { ...notificationMetadata, totalAudienceCount: attachedAudienceCount },
    );
  }
  if (attachedAudienceCount === 0) {
    await finalizePushMessageLog({
      id: messageLog.id,
      targeted: 0,
      delivered: 0,
      failed: 0,
    });
    return { targeted: 0, delivered: 0, failed: 0 } satisfies DeliveryResult;
  }

  const serialized = buildNotificationPayload({
    ...payload,
    url: sanitizeNotificationUrl(payload.url) ?? "/",
  });

  let targeted = 0;
  let delivered = 0;
  let failed = 0;

  const visitNotificationRecipientPages = async (
    visitPage: (recipientMemberIds: string[]) => Promise<void>,
  ) => {
    let afterMemberId: string | null = null;
    let memberPage = await listNotificationRecipientPage(
      createdNotification.notification.id,
      afterMemberId,
    );
    while (memberPage.length > 0) {
      await visitPage(memberPage);
      if (memberPage.length < PUSH_AUDIENCE_PAGE_SIZE) {
        break;
      }
      afterMemberId = memberPage.at(-1) ?? null;
      memberPage = await listNotificationRecipientPage(
        createdNotification.notification.id,
        afterMemberId,
      );
    }
  };

  const webpush = await getWebPush();

  const sendMemberPage = async (recipientMemberIds: string[]) => {
    if (recipientMemberIds.length === 0) {
      return;
    }
    const safeSubscriptions = await listAudiencePushSubscriptions(recipientMemberIds);
    if (safeSubscriptions.length === 0) {
      return;
    }
    const preferenceMemberIds = Array.from(
      new Set(safeSubscriptions.map((item) => item.member_id)),
    );
    const preferences = await listPushPreferences(preferenceMemberIds);
    const preferenceKey = getPreferenceKey(payload.type);
    const preferenceMap = new Map(
      preferences.map((item) => [
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
    targeted += targets.length;

    await forEachWithConcurrency(targets, PUSH_SEND_CONCURRENCY, async (subscription) => {
      let providerError: unknown = null;
      try {
        await webpush.sendNotification(
          await buildTrustedPushSubscriptionRequest({
            endpoint: subscription.endpoint,
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          }),
          serialized,
        );
      } catch (error) {
        providerError = error;
      }

      if (!providerError) {
        delivered += 1;
        await settlePushBookkeeping([
          markPushSuccess(subscription.id),
          logPushDelivery({
            messageLogId: messageLog.id,
            memberId: subscription.member_id,
            subscriptionId: subscription.id,
            payload,
            status: "sent",
          }),
          notificationRepository.recordNotificationDelivery({
            notificationId: createdNotification.notification.id,
            memberId: subscription.member_id,
            channel: "push",
            status: "sent",
          }),
        ], "sent");
        return;
      }

      failed += 1;
      const statusCode =
        typeof providerError === "object" &&
        providerError &&
        "statusCode" in providerError
          ? Number((providerError as { statusCode?: number }).statusCode)
          : null;
      const errorMessage =
        providerError instanceof Error
          ? providerError.message
          : "푸시 알림 전송에 실패했습니다.";
      const deactivate =
        (providerError instanceof PushError &&
          providerError.code === "invalid_request") ||
        statusCode === 404 ||
        statusCode === 410;
      await settlePushBookkeeping([
        markPushFailure(subscription, errorMessage, deactivate),
        logPushDelivery({
          messageLogId: messageLog.id,
          memberId: subscription.member_id,
          subscriptionId: subscription.id,
          payload,
          status: "failed",
          errorMessage,
        }),
        notificationRepository.recordNotificationDelivery({
          notificationId: createdNotification.notification.id,
          memberId: subscription.member_id,
          channel: "push",
          status: "failed",
          errorMessage,
        }),
      ], "failed");
    });
  };

  await visitNotificationRecipientPages(sendMemberPage);

  await finalizePushMessageLog({
    id: messageLog.id,
    targeted,
    delivered,
    failed,
  });

  return {
    targeted,
    delivered,
    failed,
  } satisfies DeliveryResult;
}

export async function sendPushTemplateTest(input: {
  memberId: string;
  payload: PushPayload;
}) {
  if (!isPushConfigured()) {
    throw new PushError("config_missing", "Web Push 환경 변수가 설정되지 않았습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id,member_id,endpoint,p256dh,auth")
    .eq("member_id", input.memberId)
    .eq("is_active", true);
  if (error) {
    throw wrapPushDbError(error, "푸시 구독을 불러오지 못했습니다.");
  }

  const subscriptions = (data ?? []) as StoredSubscription[];
  if (subscriptions.length === 0) {
    return { targeted: 0, delivered: 0, failed: 0 } satisfies DeliveryResult;
  }

  const messageLog = await createPushMessageLog({
    payload: input.payload,
    source: "manual",
    audience: {
      scope: "member",
      label: "템플릿 테스트 수신 회원",
      year: null,
      campus: null,
      memberId: input.memberId,
      memberIds: [input.memberId],
    },
  });
  const webpush = await getWebPush();
  const serialized = buildNotificationPayload({
    ...input.payload,
    url: sanitizeNotificationUrl(input.payload.url) ?? "/",
  });
  let delivered = 0;
  let failed = 0;

  await forEachWithConcurrency(
    subscriptions,
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
        delivered += 1;
        await Promise.all([
          markPushSuccess(subscription.id),
          logPushDelivery({
            messageLogId: messageLog.id,
            memberId: subscription.member_id,
            subscriptionId: subscription.id,
            payload: input.payload,
            status: "sent",
          }),
        ]);
      } catch (error) {
        failed += 1;
        const deactivate =
          error instanceof PushError && error.code === "invalid_request";
        await Promise.all([
          markPushFailure(subscription, "템플릿 테스트 푸시 발송 실패", deactivate),
          logPushDelivery({
            messageLogId: messageLog.id,
            memberId: subscription.member_id,
            subscriptionId: subscription.id,
            payload: input.payload,
            status: "failed",
            errorMessage: "템플릿 테스트 푸시 발송 실패",
          }),
        ]);
      }
    },
  );

  await finalizePushMessageLog({
    id: messageLog.id,
    targeted: subscriptions.length,
    delivered,
    failed,
  });

  return { targeted: subscriptions.length, delivered, failed } satisfies DeliveryResult;
}
