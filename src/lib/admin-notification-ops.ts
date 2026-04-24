import { notificationRepository } from "@/lib/repositories";
import {
  hasSenderCredentials,
} from "@/lib/mattermost/config";
import {
  getNotificationChannelLabel,
  normalizeNotificationTargetUrl,
  type NotificationChannel,
} from "@/lib/notifications/shared";
import { getPolicyDocumentByKind } from "@/lib/policy-documents";
import { getActiveSubscriptionPushPreferences } from "@/lib/push/preferences";
import { getPushEnv, isPushConfigured } from "@/lib/push/config";
import { resolvePushAudience } from "@/lib/push/audience";
import type {
  PushAudience,
  PushNotificationType,
} from "@/lib/push";
import type {
  PushPreferenceState,
  ResolvedPushAudience,
  StoredSubscription,
  WebPushModule,
} from "@/lib/push/types";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  EMPTY_CHANNEL_RESULTS,
  absoluteUrl,
  computeOperationStatus,
  getMattermostSenderCandidateYears,
  getNotificationTypeLabel,
  getPreviewReasonLabel,
  getTypePreferenceEnabled,
  isAdminNotificationType,
  isMattermostConfigured,
  mergeExclusionReasons,
  normalizeSelectedChannels,
  normalizeSourceYears,
  parseLogMetadata,
} from "@/lib/admin-notification-ops-utils";
import {
  sendMattermostCampaignDeliveries,
  sendPushCampaignDeliveries,
} from "@/lib/admin-notification-ops-delivery";

export const ADMIN_NOTIFICATION_TYPES = [
  "announcement",
  "marketing",
  "new_partner",
  "expiring_partner",
] as const;

export type AdminNotificationType = (typeof ADMIN_NOTIFICATION_TYPES)[number];

export type AdminNotificationSource = "manual" | "automatic";

export type AdminNotificationChannelSelection = Record<NotificationChannel, boolean>;

export type AdminNotificationComposerInput = {
  notificationType: AdminNotificationType;
  title: string;
  body: string;
  url?: string | null;
  audience: PushAudience;
  channels: AdminNotificationChannelSelection;
  confirmationText?: string | null;
};

export type AdminNotificationPreviewReasonCode =
  | "type_disabled"
  | "marketing_not_consented"
  | "push_disabled"
  | "no_push_subscription"
  | "mm_disabled"
  | "channel_unavailable";

export type AdminNotificationPreviewReason = {
  code: AdminNotificationPreviewReasonCode;
  label: string;
  count: number;
};

export type AdminNotificationEligibleMember = {
  id: string;
  name: string;
  mmUsername: string;
  year: number;
  campus: string | null;
  channels: NotificationChannel[];
};

export type AdminNotificationChannelPreview = {
  channel: NotificationChannel;
  label: string;
  eligibleCount: number;
  excludedCount: number;
  reasons: AdminNotificationPreviewReason[];
};

export type AdminNotificationPreview = {
  notificationType: AdminNotificationType;
  selectedChannels: NotificationChannel[];
  audienceScope: ResolvedPushAudience["scope"];
  audienceLabel: string;
  totalAudienceCount: number;
  eligibleMemberCount: number;
  eligibleMembers: AdminNotificationEligibleMember[];
  destinationLabel: string;
  channels: AdminNotificationChannelPreview[];
  canSend: boolean;
  highRisk: boolean;
  requiresConfirmation: boolean;
  confirmationPhrase: string;
  validationMessage: string | null;
};

export type AdminNotificationSendResult = {
  notificationId: string;
  preview: AdminNotificationPreview;
  channelResults: Record<
    NotificationChannel,
    {
      targeted: number;
      sent: number;
      failed: number;
      skipped: number;
    }
  >;
};

export type AdminNotificationOperationLog = {
  id: string;
  notificationType: AdminNotificationType;
  source: AdminNotificationSource;
  selectedChannels: NotificationChannel[];
  targetScope: ResolvedPushAudience["scope"];
  targetLabel: string;
  targetYear: number | null;
  targetCampus: string | null;
  targetMemberId: string | null;
  title: string;
  body: string;
  url: string | null;
  status: "pending" | "sent" | "partial_failed" | "failed" | "no_target";
  totalAudienceCount: number;
  marketing: boolean;
  channelResults: Record<
    NotificationChannel,
    {
      targeted: number;
      sent: number;
      failed: number;
      skipped: number;
    }
  >;
  exclusionReasons: AdminNotificationPreviewReason[];
  createdAt: string;
  completedAt: string | null;
};

export type AutomaticNotificationRuleSummary = {
  notificationType: Extract<AdminNotificationType, "new_partner" | "expiring_partner">;
  label: string;
  lastRunAt: string | null;
  recentCount: number;
  failedCount: number;
  failureSamples: string[];
};

type AudienceMember = {
  id: string;
  mm_user_id: string;
  mm_username: string;
  display_name: string | null;
  year: number;
  campus: string | null;
  is_staff: boolean;
  source_years: number[];
  marketing_policy_version: number | null;
  marketing_policy_consented_at: string | null;
};

type AudienceContext = {
  resolvedAudience: ResolvedPushAudience;
  members: AudienceMember[];
  preview: AdminNotificationPreview;
  selectedChannels: NotificationChannel[];
  destinationUrl: string;
  eligibleMemberIds: Record<NotificationChannel, string[]>;
  pushSubscriptions: StoredSubscription[];
};

type NotificationCampaignMetadata = {
  campaignKind: "admin_notification_operation";
  notificationType: AdminNotificationType;
  source: AdminNotificationSource;
  audience: ResolvedPushAudience["scope"];
  audienceLabel: string;
  audienceYear: number | null;
  audienceCampus: string | null;
  audienceMemberId: string | null;
  selectedChannels: NotificationChannel[];
  totalAudienceCount: number;
  destinationLabel: string;
  previewSummary: {
    highRisk: boolean;
    confirmationPhrase: string;
    channels: AdminNotificationChannelPreview[];
  };
  channelResults?: AdminNotificationSendResult["channelResults"];
  campaignStatus?: AdminNotificationOperationLog["status"];
  completedAt?: string | null;
};

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  target_url: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type NotificationDeliveryRow = {
  notification_id: string;
  channel: NotificationChannel;
  status: "pending" | "sent" | "failed" | "skipped";
};

type PushMessageLogRow = {
  id: string;
  type: string;
  source: "manual" | "automatic";
  target_scope: ResolvedPushAudience["scope"];
  target_label: string;
  target_year: number | null;
  target_campus: string | null;
  target_member_id: string | null;
  title: string;
  body: string;
  url: string | null;
  status: "pending" | "sent" | "partial_failed" | "failed" | "no_target";
  targeted: number;
  delivered: number;
  failed: number;
  created_at: string | null;
  completed_at: string | null;
};

let webPushPromise: Promise<WebPushModule> | null = null;

export function isMattermostNotificationConfigured() {
  return isMattermostConfigured();
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

async function listAudienceMembers(resolvedAudience: ResolvedPushAudience) {
  const supabase = getSupabaseAdminClient();
  const baseQuery = supabase
    .from("members")
    .select(
      "id,mm_user_id,mm_username,display_name,year,campus,marketing_policy_version,marketing_policy_consented_at",
    );

  const query =
    resolvedAudience.scope === "year"
      ? baseQuery.eq("year", resolvedAudience.year)
      : resolvedAudience.scope === "campus"
        ? baseQuery.eq("campus", resolvedAudience.campus)
        : resolvedAudience.scope === "member"
          ? baseQuery.in("id", resolvedAudience.memberIds ?? (resolvedAudience.memberId ? [resolvedAudience.memberId] : []))
          : baseQuery;

  const { data, error } = await query.order("display_name", { ascending: true });
  if (error) {
    throw new Error("발송 대상을 불러오지 못했습니다.");
  }

  const members = (data ?? []) as Array<Omit<AudienceMember, "is_staff" | "source_years">>;
  const mmUserIds = members.map((member) => member.mm_user_id).filter(Boolean);

  const { data: directoryRows, error: directoryError } = mmUserIds.length
    ? await supabase
        .from("mm_user_directory")
        .select("mm_user_id,is_staff,source_years")
        .in("mm_user_id", mmUserIds)
    : { data: [], error: null };

  if (directoryError) {
    throw new Error("Mattermost 유저 디렉토리를 불러오지 못했습니다.");
  }

  const directoryMap = new Map(
    (directoryRows ?? []).map((row) => [
      row.mm_user_id,
      {
        is_staff: Boolean(row.is_staff),
        source_years: normalizeSourceYears(row.source_years),
      },
    ]),
  );

  return members.map((member) => {
    const directoryEntry = directoryMap.get(member.mm_user_id);
    return {
      ...member,
      is_staff: directoryEntry?.is_staff ?? member.year === 0,
      source_years: directoryEntry?.source_years ?? [],
    } satisfies AudienceMember;
  });
}

async function buildAudienceContext(
  input: AdminNotificationComposerInput,
) : Promise<AudienceContext> {
  const selectedChannels = normalizeSelectedChannels(input.channels);
  const destinationUrl = normalizeNotificationTargetUrl(input.url) ?? "/notifications";
  const notificationType = input.notificationType;
  const validationMessages: string[] = [];
  const rawUrl = input.url?.trim() ?? "";

  if (selectedChannels.length === 0) {
    validationMessages.push("최소 한 개 이상의 채널을 선택해 주세요.");
  }
  if (rawUrl && !normalizeNotificationTargetUrl(rawUrl)) {
    validationMessages.push("이동 URL은 내부 경로만 사용할 수 있습니다.");
  }
  if (selectedChannels.includes("push") && !isPushConfigured()) {
    validationMessages.push("푸시 채널이 아직 설정되지 않았습니다.");
  }
  if (selectedChannels.includes("mm") && !isMattermostConfigured()) {
    validationMessages.push("Mattermost 채널 발송 설정이 아직 준비되지 않았습니다.");
  }

  const resolvedAudience = await resolvePushAudience(input.audience);
  const members = await listAudienceMembers(resolvedAudience);
  const activeMarketingPolicy = await getPolicyDocumentByKind("marketing").catch(
    () => null,
  );
  const activeMarketingPolicyVersion = activeMarketingPolicy?.version ?? null;
  const memberIds = members.map((member) => member.id);
  const supabase = getSupabaseAdminClient();

  const [{ data: preferences }, { data: subscriptions }] = await Promise.all([
    memberIds.length
      ? supabase
          .from("push_preferences")
          .select(
            "member_id,enabled,announcement_enabled,new_partner_enabled,expiring_partner_enabled,review_enabled,mm_enabled,marketing_enabled",
          )
          .in("member_id", memberIds)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length
      ? supabase
          .from("push_subscriptions")
          .select("id,member_id,endpoint,p256dh,auth")
          .eq("is_active", true)
          .in("member_id", memberIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

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
  const subscriptionsByMemberId = new Map<string, StoredSubscription[]>();
  for (const subscription of (subscriptions ?? []) as StoredSubscription[]) {
    const current = subscriptionsByMemberId.get(subscription.member_id) ?? [];
    current.push(subscription);
    subscriptionsByMemberId.set(subscription.member_id, current);
  }

  const channelReasonCounts = {
    in_app: new Map<AdminNotificationPreviewReasonCode, number>(),
    push: new Map<AdminNotificationPreviewReasonCode, number>(),
    mm: new Map<AdminNotificationPreviewReasonCode, number>(),
  } satisfies Record<NotificationChannel, Map<AdminNotificationPreviewReasonCode, number>>;

  const eligibleMemberIds: Record<NotificationChannel, string[]> = {
    in_app: [],
    push: [],
    mm: [],
  };
  const pushSubscriptions: StoredSubscription[] = [];

  for (const member of members) {
    const preference = getActiveSubscriptionPushPreferences(preferenceMap.get(member.id));
    const hasCurrentMarketingConsent =
      activeMarketingPolicyVersion !== null &&
      member.marketing_policy_version === activeMarketingPolicyVersion;
    const normalizedPreference = {
      ...preference,
      marketingEnabled: hasCurrentMarketingConsent,
    };
    const typeEnabled = getTypePreferenceEnabled(notificationType, normalizedPreference);
    const marketingAllowed =
      notificationType !== "marketing" || hasCurrentMarketingConsent;

    const activeSubscriptions = subscriptionsByMemberId.get(member.id) ?? [];
    const channelReasons: Partial<Record<NotificationChannel, AdminNotificationPreviewReasonCode>> = {};

    if (!typeEnabled) {
      channelReasons.in_app = "type_disabled";
      channelReasons.push = "type_disabled";
      channelReasons.mm = "type_disabled";
    } else if (!marketingAllowed) {
      channelReasons.in_app = "marketing_not_consented";
      channelReasons.push = "marketing_not_consented";
      channelReasons.mm = "marketing_not_consented";
    }

    if (!channelReasons.in_app) {
      eligibleMemberIds.in_app.push(member.id);
    }

    if (!channelReasons.push) {
      if (!preference.enabled) {
        channelReasons.push = "push_disabled";
      } else if (activeSubscriptions.length === 0) {
        channelReasons.push = "no_push_subscription";
      } else {
        eligibleMemberIds.push.push(member.id);
        pushSubscriptions.push(...activeSubscriptions);
      }
    }

    if (!channelReasons.mm) {
      if (!preference.mmEnabled) {
        channelReasons.mm = "mm_disabled";
      } else if (
        !getMattermostSenderCandidateYears(member).some((year) =>
          hasSenderCredentials(year, { allowDefaultFallback: false }),
        )
      ) {
        channelReasons.mm = "channel_unavailable";
      } else {
        eligibleMemberIds.mm.push(member.id);
      }
    }

    for (const channel of selectedChannels) {
      const reason = channelReasons[channel];
      if (!reason) {
        continue;
      }
      channelReasonCounts[channel].set(reason, (channelReasonCounts[channel].get(reason) ?? 0) + 1);
    }
  }

  const channels = selectedChannels.map((channel) => {
    const reasons = Array.from(channelReasonCounts[channel].entries())
      .map(([code, count]) => ({
        code,
        label: getPreviewReasonLabel(code),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      channel,
      label: getNotificationChannelLabel(channel),
      eligibleCount: eligibleMemberIds[channel].length,
      excludedCount: members.length - eligibleMemberIds[channel].length,
      reasons,
    } satisfies AdminNotificationChannelPreview;
  });

  const eligibleMemberIdsByChannel = {
    in_app: new Set(eligibleMemberIds.in_app),
    push: new Set(eligibleMemberIds.push),
    mm: new Set(eligibleMemberIds.mm),
  } satisfies Record<NotificationChannel, Set<string>>;

  const eligibleMembers = members
    .map((member) => {
      const channelsForMember = selectedChannels.filter((channel) =>
        eligibleMemberIdsByChannel[channel].has(member.id),
      );

      if (channelsForMember.length === 0) {
        return null;
      }

      return {
        id: member.id,
        name: member.display_name?.trim() || member.mm_username,
        mmUsername: member.mm_username,
        year: member.year,
        campus: member.campus,
        channels: channelsForMember,
      } satisfies AdminNotificationEligibleMember;
    })
    .filter((member): member is AdminNotificationEligibleMember => Boolean(member));

  const highRisk =
    selectedChannels.length > 1 ||
    resolvedAudience.scope === "all" ||
    notificationType === "marketing";
  const preview: AdminNotificationPreview = {
    notificationType,
    selectedChannels,
    audienceScope: resolvedAudience.scope,
    audienceLabel: resolvedAudience.label,
    totalAudienceCount: members.length,
    eligibleMemberCount: eligibleMembers.length,
    eligibleMembers,
    destinationLabel: absoluteUrl(destinationUrl),
    channels,
    canSend:
      validationMessages.length === 0 &&
      channels.some((channel) => channel.eligibleCount > 0),
    highRisk,
    requiresConfirmation: highRisk,
    confirmationPhrase:
      notificationType === "marketing" ? "마케팅 알림 발송" : "알림 발송",
    validationMessage: validationMessages[0] ?? null,
  };

  return {
    resolvedAudience,
    members,
    preview,
    selectedChannels,
    destinationUrl,
    eligibleMemberIds,
    pushSubscriptions,
  };
}

function toPushPayload(input: AdminNotificationComposerInput) {
  return {
    type: input.notificationType as PushNotificationType,
    title: input.title.trim(),
    body: input.body.trim(),
    url: normalizeNotificationTargetUrl(input.url) ?? "/notifications",
    tag: `${input.notificationType}-${Date.now()}`,
  };
}

export async function previewAdminNotificationCampaign(
  input: AdminNotificationComposerInput,
) {
  const context = await buildAudienceContext(input);
  return context.preview;
}

export async function sendAdminNotificationCampaign(
  input: AdminNotificationComposerInput,
  source: AdminNotificationSource = "manual",
): Promise<AdminNotificationSendResult> {
  const context = await buildAudienceContext(input);
  if (!context.preview.canSend) {
    throw new Error(context.preview.validationMessage ?? "발송 가능한 대상이 없습니다.");
  }
  if (
    source !== "automatic" &&
    context.preview.requiresConfirmation &&
    (input.confirmationText ?? "").trim() !== context.preview.confirmationPhrase
  ) {
    throw new Error(`확인 문구 '${context.preview.confirmationPhrase}'를 정확히 입력해 주세요.`);
  }

  const metadata: NotificationCampaignMetadata = {
    campaignKind: "admin_notification_operation",
    notificationType: input.notificationType,
    source,
    audience: context.resolvedAudience.scope,
    audienceLabel: context.resolvedAudience.label,
    audienceYear: context.resolvedAudience.year,
    audienceCampus: context.resolvedAudience.campus,
    audienceMemberId: context.resolvedAudience.memberId,
    selectedChannels: context.selectedChannels,
    totalAudienceCount: context.members.length,
    destinationLabel: context.preview.destinationLabel,
    previewSummary: {
      highRisk: context.preview.highRisk,
      confirmationPhrase: context.preview.confirmationPhrase,
      channels: context.preview.channels,
    },
  };

  const created = await notificationRepository.createNotification({
    type: input.notificationType,
    title: input.title.trim(),
    body: input.body.trim(),
    targetUrl: context.destinationUrl,
    metadata,
    recipientMemberIds: context.selectedChannels.includes("in_app")
      ? context.eligibleMemberIds.in_app
      : [],
  });

  const channelResults: AdminNotificationSendResult["channelResults"] = structuredClone(EMPTY_CHANNEL_RESULTS);
  if (context.selectedChannels.includes("in_app")) {
    channelResults.in_app = {
      targeted: context.eligibleMemberIds.in_app.length,
      sent: context.eligibleMemberIds.in_app.length,
      failed: 0,
      skipped: context.members.length - context.eligibleMemberIds.in_app.length,
    };
  }

  if (context.selectedChannels.includes("push")) {
    channelResults.push = await sendPushCampaignDeliveries({
      notificationId: created.notification.id,
      payload: toPushPayload(input),
      source,
      resolvedAudience: context.resolvedAudience,
      subscriptions: context.pushSubscriptions,
      getWebPush,
    });
    channelResults.push.skipped = context.members.length - context.eligibleMemberIds.push.length;
  }

  if (context.selectedChannels.includes("mm")) {
    channelResults.mm = await sendMattermostCampaignDeliveries({
      notificationId: created.notification.id,
      notificationType: input.notificationType,
      title: input.title,
      body: input.body,
      url: input.url?.trim() ? normalizeNotificationTargetUrl(input.url) : null,
      members: context.members.filter((member) => context.eligibleMemberIds.mm.includes(member.id)),
    });
    channelResults.mm.skipped = context.members.length - context.eligibleMemberIds.mm.length;
  }

  const completedMetadata = {
    ...metadata,
    channelResults,
    campaignStatus: computeOperationStatus(channelResults),
    completedAt: new Date().toISOString(),
  } satisfies NotificationCampaignMetadata;
  await notificationRepository.updateNotificationMetadata(created.notification.id, completedMetadata);

  return {
    notificationId: created.notification.id,
    preview: context.preview,
    channelResults,
  };
}

export async function getRecentAdminNotificationOperationLogs(limit = 50) {
  const supabase = getSupabaseAdminClient();
  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("id,type,title,body,target_url,metadata,created_at")
    .in("type", [...ADMIN_NOTIFICATION_TYPES])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[admin-notification-ops] notifications query failed", error.message);
  } else {
    const rows = (notifications ?? []) as NotificationRow[];
    if (rows.length) {
      const { data: deliveries, error: deliveryError } = await supabase
        .from("notification_deliveries")
        .select("notification_id,channel,status")
        .in("notification_id", rows.map((row) => row.id));
      if (deliveryError) {
        console.error(
          "[admin-notification-ops] notification_deliveries query failed",
          deliveryError.message,
        );
      }

      const deliveriesByNotification = new Map<string, NotificationDeliveryRow[]>();
      for (const delivery of (deliveries ?? []) as NotificationDeliveryRow[]) {
        const current = deliveriesByNotification.get(delivery.notification_id) ?? [];
        current.push(delivery);
        deliveriesByNotification.set(delivery.notification_id, current);
      }

      return rows
        .map((row) => {
          const metadata = parseLogMetadata(row.metadata, ADMIN_NOTIFICATION_TYPES);
          const notificationType =
            metadata.notificationType ??
            (isAdminNotificationType(row.type, ADMIN_NOTIFICATION_TYPES) ? row.type : "announcement");
          const channelResults = structuredClone(EMPTY_CHANNEL_RESULTS);
          const channelDeliveries = deliveriesByNotification.get(row.id) ?? [];

          for (const channel of metadata.selectedChannels) {
            const entries = channelDeliveries.filter((item) => item.channel === channel);
            const sent = entries.filter((item) => item.status === "sent").length;
            const failed = entries.filter((item) => item.status === "failed").length;
            const skipped = entries.filter((item) => item.status === "skipped").length;
            const fallback = metadata.channelResults?.[channel];
            const targeted = sent + failed + skipped;
            channelResults[channel] =
              targeted || fallback
                ? {
                    targeted: Math.max(targeted, fallback?.targeted ?? 0),
                    sent: Math.max(sent, fallback?.sent ?? 0),
                    failed: Math.max(failed, fallback?.failed ?? 0),
                    skipped: Math.max(skipped, fallback?.skipped ?? 0),
                  }
                : channelResults[channel];
          }

          const exclusionReasons = mergeExclusionReasons(metadata.previewChannels);

          return {
            id: row.id,
            notificationType,
            source: metadata.source,
            selectedChannels: metadata.selectedChannels,
            targetScope: metadata.audience,
            targetLabel: metadata.audienceLabel,
            targetYear: metadata.audienceYear,
            targetCampus: metadata.audienceCampus,
            targetMemberId: metadata.audienceMemberId,
            title: row.title,
            body: row.body,
            url: row.target_url,
            status: metadata.campaignStatus ?? computeOperationStatus(channelResults),
            totalAudienceCount: metadata.totalAudienceCount,
            marketing: notificationType === "marketing",
            channelResults,
            exclusionReasons,
            createdAt: row.created_at,
            completedAt: metadata.completedAt,
          } satisfies AdminNotificationOperationLog;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }

  const { data: pushLogs, error: pushLogError } = await supabase
    .from("push_message_logs")
    .select(
      "id,type,source,target_scope,target_label,target_year,target_campus,target_member_id,title,body,url,status,targeted,delivered,failed,created_at,completed_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (pushLogError) {
    console.error("[admin-notification-ops] push_message_logs query failed", pushLogError.message);
    return [] as AdminNotificationOperationLog[];
  }

  return ((pushLogs ?? []) as PushMessageLogRow[]).map((row) => ({
    id: row.id,
    notificationType: isAdminNotificationType(row.type, ADMIN_NOTIFICATION_TYPES) ? row.type : "announcement",
    source: row.source,
    selectedChannels: [],
    targetScope: row.target_scope,
    targetLabel: row.target_label,
    targetYear: row.target_year,
    targetCampus: row.target_campus,
    targetMemberId: row.target_member_id,
    title: row.title,
    body: row.body,
    url: row.url,
    status: row.status,
    totalAudienceCount: row.targeted,
    marketing: row.type === "marketing",
    channelResults: structuredClone(EMPTY_CHANNEL_RESULTS),
    exclusionReasons: [],
    createdAt: row.created_at ?? new Date(0).toISOString(),
    completedAt: row.completed_at,
  }));
}

export async function getAutomaticNotificationRuleSummaries(limit = 30) {
  const logs = await getRecentAdminNotificationOperationLogs(limit);
  return summarizeAutomaticNotificationRuleSummaries(logs);
}

function summarizeAutomaticNotificationRuleSummaries(
  logs: AdminNotificationOperationLog[],
) {
  return (["new_partner", "expiring_partner"] as const).map((notificationType) => {
    const items = logs.filter(
      (log) => log.notificationType === notificationType && log.source === "automatic",
    );
    return {
      notificationType,
      label: getNotificationTypeLabel(notificationType),
      lastRunAt: items[0]?.createdAt ?? null,
      recentCount: items.length,
      failedCount: items.filter((item) => item.status === "failed" || item.status === "partial_failed").length,
      failureSamples: items
        .filter((item) => item.status === "failed" || item.status === "partial_failed")
        .slice(0, 3)
        .map((item) => `${item.title} · ${item.status}`),
    } satisfies AutomaticNotificationRuleSummary;
  });
}

export async function getAdminNotificationOverview(
  recentLogLimit = 50,
  automaticSummaryLimit = 30,
) {
  const fetchLimit = Math.max(recentLogLimit, automaticSummaryLimit);
  const logs = await getRecentAdminNotificationOperationLogs(fetchLimit);

  return {
    recentLogs: logs.slice(0, recentLogLimit),
    automaticSummaries: summarizeAutomaticNotificationRuleSummaries(
      logs.slice(0, automaticSummaryLimit),
    ),
  };
}
