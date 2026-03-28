import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";
import { sanitizeHttpUrl } from "@/lib/validation";

export const DEFAULT_PUSH_PREFERENCES = {
  enabled: false,
  announcementEnabled: true,
  newPartnerEnabled: true,
  expiringPartnerEnabled: true,
} as const;

export type PushPreferenceState = {
  enabled: boolean;
  announcementEnabled: boolean;
  newPartnerEnabled: boolean;
  expiringPartnerEnabled: boolean;
};

export type PushNotificationType =
  | "announcement"
  | "new_partner"
  | "expiring_partner";

export type PushPayload = {
  type: PushNotificationType;
  title: string;
  body: string;
  url?: string | null;
  tag?: string | null;
};

type SubscriptionInput = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

type StoredSubscription = {
  id: string;
  member_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type DeliveryResult = {
  targeted: number;
  delivered: number;
  failed: number;
};

type WebPushModule = typeof import("web-push");

let webPushPromise: Promise<WebPushModule> | null = null;

function getPushEnv() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Web Push를 사용하려면 NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT가 필요합니다.",
    );
  }

  return { publicKey, privateKey, subject };
}

function isMissingPushTableError(error: { code?: string | null; message?: string | null }) {
  return (
    error.code === "42P01" ||
    error.message?.includes('relation "push_') ||
    error.message?.includes("Could not find the table")
  );
}

export function isPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
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

export function getPushPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
}

export function getPushPreferencesOrDefault(
  value?: Partial<PushPreferenceState> | null,
): PushPreferenceState {
  return {
    enabled: value?.enabled ?? DEFAULT_PUSH_PREFERENCES.enabled,
    announcementEnabled:
      value?.announcementEnabled ?? DEFAULT_PUSH_PREFERENCES.announcementEnabled,
    newPartnerEnabled:
      value?.newPartnerEnabled ?? DEFAULT_PUSH_PREFERENCES.newPartnerEnabled,
    expiringPartnerEnabled:
      value?.expiringPartnerEnabled ??
      DEFAULT_PUSH_PREFERENCES.expiringPartnerEnabled,
  };
}

export async function getMemberPushPreferences(memberId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("push_preferences")
    .select(
      "enabled,announcement_enabled,new_partner_enabled,expiring_partner_enabled",
    )
    .eq("member_id", memberId)
    .maybeSingle();

  if (error) {
    if (isMissingPushTableError(error)) {
      return getPushPreferencesOrDefault();
    }
    throw new Error(error.message);
  }

  return getPushPreferencesOrDefault(
    data
      ? {
          enabled: data.enabled,
          announcementEnabled: data.announcement_enabled,
          newPartnerEnabled: data.new_partner_enabled,
          expiringPartnerEnabled: data.expiring_partner_enabled,
        }
      : null,
  );
}

export async function upsertMemberPushPreferences(
  memberId: string,
  value: Partial<PushPreferenceState>,
) {
  const current = await getMemberPushPreferences(memberId);
  const next = getPushPreferencesOrDefault({ ...current, ...value });
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("push_preferences").upsert(
    {
      member_id: memberId,
      enabled: next.enabled,
      announcement_enabled: next.announcementEnabled,
      new_partner_enabled: next.newPartnerEnabled,
      expiring_partner_enabled: next.expiringPartnerEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  return next;
}

function validateSubscription(input: SubscriptionInput) {
  const endpoint = sanitizeHttpUrl(input.endpoint);
  if (!endpoint?.startsWith("https://")) {
    throw new Error("유효한 Push 구독 정보를 찾을 수 없습니다.");
  }
  const p256dh = input.keys?.p256dh?.trim();
  const auth = input.keys?.auth?.trim();
  if (!p256dh || !auth) {
    throw new Error("Push 구독 키가 누락되었습니다.");
  }

  return {
    endpoint,
    p256dh,
    auth,
    expirationTime:
      typeof input.expirationTime === "number" && Number.isFinite(input.expirationTime)
        ? new Date(input.expirationTime).toISOString()
        : null,
  };
}

export async function upsertPushSubscription(params: {
  memberId: string;
  subscription: SubscriptionInput;
  userAgent?: string | null;
}) {
  const { memberId, subscription, userAgent } = params;
  const validated = validateSubscription(subscription);
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      member_id: memberId,
      endpoint: validated.endpoint,
      p256dh: validated.p256dh,
      auth: validated.auth,
      expiration_time: validated.expirationTime,
      user_agent: userAgent?.trim() || null,
      is_active: true,
      failure_reason: null,
      last_failure_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    throw new Error(error.message);
  }

  return upsertMemberPushPreferences(memberId, { enabled: true });
}

export async function deactivatePushSubscription(params: {
  memberId: string;
  endpoint?: string | null;
}) {
  const { memberId, endpoint } = params;
  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("push_subscriptions")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("member_id", memberId);

  if (endpoint) {
    query = query.eq("endpoint", endpoint);
  }

  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return upsertMemberPushPreferences(memberId, { enabled: false });
}

function getPreferenceKey(type: PushNotificationType) {
  switch (type) {
    case "announcement":
      return "announcementEnabled" as const;
    case "new_partner":
      return "newPartnerEnabled" as const;
    case "expiring_partner":
      return "expiringPartnerEnabled" as const;
  }
}

function sanitizeNotificationUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  return sanitizeHttpUrl(trimmed);
}

function toAbsoluteUrl(url?: string | null) {
  if (!url) {
    return `${SITE_URL}/`;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return new URL(url, SITE_URL).toString();
}

function buildNotificationPayload(payload: PushPayload) {
  return JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    tag: payload.tag ?? `${payload.type}-${Date.now()}`,
    type: payload.type,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  });
}

async function logPushDelivery(params: {
  memberId: string;
  subscriptionId: string;
  payload: PushPayload;
  status: "sent" | "failed";
  errorMessage?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  await supabase.from("push_delivery_logs").insert({
    member_id: params.memberId,
    subscription_id: params.subscriptionId,
    type: params.payload.type,
    title: params.payload.title,
    body: params.payload.body,
    url: params.payload.url ?? null,
    status: params.status,
    error_message: params.errorMessage ?? null,
  });
}

async function markPushSuccess(subscriptionId: string) {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("push_subscriptions")
    .update({
      last_success_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      failure_reason: null,
    })
    .eq("id", subscriptionId);
}

async function markPushFailure(
  subscription: StoredSubscription,
  errorMessage: string,
  deactivate: boolean,
) {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("push_subscriptions")
    .update({
      is_active: deactivate ? false : true,
      last_failure_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      failure_reason: errorMessage,
    })
    .eq("id", subscription.id);
}

export async function sendPushToAudience(payload: PushPayload) {
  if (!isPushConfigured()) {
    throw new Error("Web Push 환경 변수가 설정되지 않았습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id,member_id,endpoint,p256dh,auth")
    .eq("is_active", true);

  if (subscriptionError) {
    throw new Error(subscriptionError.message);
  }

  const safeSubscriptions = (subscriptions ?? []) as StoredSubscription[];
  if (safeSubscriptions.length === 0) {
    return { targeted: 0, delivered: 0, failed: 0 } satisfies DeliveryResult;
  }

  const memberIds = Array.from(new Set(safeSubscriptions.map((item) => item.member_id)));
  const { data: preferences, error: preferenceError } = await supabase
    .from("push_preferences")
    .select(
      "member_id,enabled,announcement_enabled,new_partner_enabled,expiring_partner_enabled",
    )
    .in("member_id", memberIds);

  if (preferenceError) {
    throw new Error(preferenceError.message);
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
      } satisfies PushPreferenceState,
    ]),
  );

  const targets = safeSubscriptions.filter((subscription) => {
    const preference = preferenceMap.get(subscription.member_id);
    return Boolean(preference?.enabled && preference[preferenceKey]);
  });

  if (targets.length === 0) {
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
          memberId: subscription.member_id,
          subscriptionId: subscription.id,
          payload,
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
      const deactivate = statusCode === 404 || statusCode === 410;
      await Promise.all([
        markPushFailure(subscription, errorMessage, deactivate),
        logPushDelivery({
          memberId: subscription.member_id,
          subscriptionId: subscription.id,
          payload,
          status: "failed",
          errorMessage,
        }),
      ]);
    }
  }

  return {
    targeted: targets.length,
    delivered,
    failed,
  } satisfies DeliveryResult;
}

export function createAnnouncementPayload(params: {
  title: string;
  body: string;
  url?: string | null;
}) {
  const title = params.title.trim();
  const body = params.body.trim();
  if (!title || !body) {
    throw new Error("제목과 내용을 모두 입력해 주세요.");
  }

  const safeUrl = sanitizeNotificationUrl(params.url);
  if (params.url?.trim() && !safeUrl) {
    throw new Error("알림 이동 URL 형식을 확인해 주세요.");
  }

  return {
    type: "announcement" as const,
    title,
    body,
    url: safeUrl,
    tag: `announcement-${Date.now()}`,
  };
}

export function createNewPartnerPayload(params: {
  partnerId: string;
  name: string;
  location: string;
  categoryLabel?: string | null;
}) {
  const place = params.location.trim();
  return {
    type: "new_partner" as const,
    title: `신규 제휴: ${params.name}`,
    body: params.categoryLabel
      ? `${params.categoryLabel} 카테고리에 새 제휴가 등록되었습니다. ${place}`
      : `새 제휴 업체가 등록되었습니다. ${place}`,
    url: `/partners/${params.partnerId}`,
    tag: `new-partner-${params.partnerId}`,
  };
}

export function createExpiringPartnerPayload(params: {
  partnerId: string;
  name: string;
  endDate: string;
}) {
  return {
    type: "expiring_partner" as const,
    title: `곧 종료: ${params.name}`,
    body: `${params.endDate}에 제휴 혜택이 종료됩니다.`,
    url: `/partners/${params.partnerId}`,
    tag: `expiring-partner-${params.partnerId}`,
  };
}

export function getPushDestinationLabel(url?: string | null) {
  const safeUrl = sanitizeNotificationUrl(url);
  if (!safeUrl) {
    return toAbsoluteUrl("/");
  }
  return toAbsoluteUrl(safeUrl);
}
