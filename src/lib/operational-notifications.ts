import { normalizeNotificationTargetUrl } from "@/lib/notifications/shared";
import {
  ADMIN_NOTIFICATION_CHANNELS,
  PARTNER_NOTIFICATION_CHANNELS,
  getDefaultAdminNotificationPreferences,
  getDefaultPartnerNotificationPreferences,
  resolveAdminNotificationChannels,
  resolvePartnerNotificationChannels,
  type AdminNotificationChannel,
  type AdminNotificationPreferenceState,
  type AdminOperationalNotificationType,
  type PartnerNotificationChannel,
  type PartnerNotificationPreferenceState,
  type PartnerOperationalNotificationType,
} from "@/lib/partner-notification-routing";
import { sendPartnerOperationalNotificationEmail } from "@/lib/partner-email";
import { getPushEnv, isPushConfigured } from "@/lib/push/config";
import type { SubscriptionInput, WebPushModule } from "@/lib/push/types";
import { PushError } from "@/lib/push/types";
import { sanitizeHttpUrl } from "@/lib/validation";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isPartnerPortalMock } from "@/lib/partner-portal";

type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";

type PushSubscriptionDevice = {
  id: string;
  label: string;
  userAgent: string | null;
  isCurrent: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastSuccessAt: string | null;
};

type OperationalSubscriptionInput = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

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

function validateSubscription(input: OperationalSubscriptionInput) {
  const endpoint = sanitizeHttpUrl(input.endpoint);
  if (!endpoint?.startsWith("https://")) {
    throw new PushError("invalid_request", "유효한 Push 구독 정보를 찾을 수 없습니다.");
  }
  const p256dh = input.keys?.p256dh?.trim();
  const auth = input.keys?.auth?.trim();
  if (!p256dh || !auth) {
    throw new PushError("invalid_request", "Push 구독 키가 누락되었습니다.");
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

function getDeviceLabel(userAgent: string | null) {
  const source = userAgent ?? "";
  const browser = source.includes("Edg/")
    ? "Edge"
    : source.includes("Chrome/")
      ? "Chrome"
      : source.includes("Firefox/")
        ? "Firefox"
        : source.includes("Safari/")
          ? "Safari"
          : "브라우저";
  const os = source.includes("Mac")
    ? "macOS"
    : source.includes("Windows")
      ? "Windows"
      : source.includes("Android")
        ? "Android"
        : source.includes("iPhone") || source.includes("iPad")
          ? "iOS"
          : "기기";
  return `${browser} · ${os}`;
}

function toTargetUrl(value?: string | null, fallback = "/") {
  return normalizeNotificationTargetUrl(value) ?? fallback;
}

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

function toAdminPreferences(row: Record<string, unknown> | null | undefined) {
  const defaults = getDefaultAdminNotificationPreferences();
  if (!row) {
    return defaults;
  }
  return {
    enabled: row.enabled === true,
    portalEnabled: row.portal_enabled !== false,
    pushEnabled: row.push_enabled !== false,
    securityEnabled: row.security_enabled !== false,
    partnerRequestEnabled: row.partner_request_enabled !== false,
    expiringPartnerEnabled: row.expiring_partner_enabled !== false,
  } satisfies AdminNotificationPreferenceState;
}

function toPartnerPreferences(row: Record<string, unknown> | null | undefined) {
  const defaults = getDefaultPartnerNotificationPreferences();
  if (!row) {
    return defaults;
  }
  return {
    enabled: row.enabled !== false,
    portalEnabled: row.portal_enabled !== false,
    pushEnabled: row.push_enabled !== false,
    emailEnabled: row.email_enabled !== false,
    planEnabled: row.plan_enabled !== false,
    expiringPartnerEnabled: row.expiring_partner_enabled !== false,
    metricsEnabled: row.metrics_enabled !== false,
  } satisfies PartnerNotificationPreferenceState;
}

export async function getAdminOperationalNotificationPreferences(adminId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_notification_preferences")
    .select(
      "enabled,portal_enabled,push_enabled,security_enabled,partner_request_enabled,expiring_partner_enabled",
    )
    .eq("admin_id", adminId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return toAdminPreferences(data as Record<string, unknown> | null);
}

export async function getPartnerOperationalNotificationPreferences(accountId: string) {
  if (isPartnerPortalMock) {
    return getDefaultPartnerNotificationPreferences();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partner_notification_preferences")
    .select(
      "enabled,portal_enabled,push_enabled,email_enabled,plan_enabled,expiring_partner_enabled,metrics_enabled",
    )
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return toPartnerPreferences(data as Record<string, unknown> | null);
}

export async function upsertAdminOperationalNotificationPreferences(
  adminId: string,
  preferences: Partial<AdminNotificationPreferenceState>,
) {
  const current = await getAdminOperationalNotificationPreferences(adminId);
  const next = { ...current, ...preferences };
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("admin_notification_preferences").upsert(
    {
      admin_id: adminId,
      enabled: next.enabled,
      portal_enabled: next.portalEnabled,
      push_enabled: next.pushEnabled,
      security_enabled: next.securityEnabled,
      partner_request_enabled: next.partnerRequestEnabled,
      expiring_partner_enabled: next.expiringPartnerEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "admin_id" },
  );
  if (error) {
    throw new Error(error.message);
  }
  return next;
}

export async function upsertPartnerOperationalNotificationPreferences(
  accountId: string,
  preferences: Partial<PartnerNotificationPreferenceState>,
) {
  if (isPartnerPortalMock) {
    return {
      ...getDefaultPartnerNotificationPreferences(),
      ...preferences,
    } satisfies PartnerNotificationPreferenceState;
  }

  const current = await getPartnerOperationalNotificationPreferences(accountId);
  const next = { ...current, ...preferences };
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("partner_notification_preferences").upsert(
    {
      account_id: accountId,
      enabled: next.enabled,
      portal_enabled: next.portalEnabled,
      push_enabled: next.pushEnabled,
      email_enabled: next.emailEnabled,
      plan_enabled: next.planEnabled,
      expiring_partner_enabled: next.expiringPartnerEnabled,
      metrics_enabled: next.metricsEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id" },
  );
  if (error) {
    throw new Error(error.message);
  }
  return next;
}

export async function upsertOperationalPushSubscription(input: {
  ownerType: "admin" | "partner";
  ownerId: string;
  subscription: SubscriptionInput;
  userAgent?: string | null;
}) {
  const validated = validateSubscription(input.subscription);
  if (input.ownerType === "partner" && isPartnerPortalMock) {
    return upsertPartnerOperationalNotificationPreferences(input.ownerId, {
      enabled: true,
      pushEnabled: true,
    });
  }

  const supabase = getSupabaseAdminClient();
  const table =
    input.ownerType === "admin" ? "admin_push_subscriptions" : "partner_push_subscriptions";
  const ownerKey = input.ownerType === "admin" ? "admin_id" : "account_id";
  const { error } = await supabase.from(table).upsert(
    {
      [ownerKey]: input.ownerId,
      endpoint: validated.endpoint,
      p256dh: validated.p256dh,
      auth: validated.auth,
      expiration_time: validated.expirationTime,
      user_agent: input.userAgent?.trim() || null,
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

  if (input.ownerType === "admin") {
    return upsertAdminOperationalNotificationPreferences(input.ownerId, {
      enabled: true,
      pushEnabled: true,
    });
  }
  return upsertPartnerOperationalNotificationPreferences(input.ownerId, {
    enabled: true,
    pushEnabled: true,
  });
}

export async function deactivateOperationalPushSubscription(input: {
  ownerType: "admin" | "partner";
  ownerId: string;
  endpoint?: string | null;
  subscriptionId?: string | null;
  all?: boolean;
}) {
  if (input.ownerType === "partner" && isPartnerPortalMock) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const table =
    input.ownerType === "admin" ? "admin_push_subscriptions" : "partner_push_subscriptions";
  const ownerKey = input.ownerType === "admin" ? "admin_id" : "account_id";
  let query = supabase
    .from(table)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq(ownerKey, input.ownerId);

  if (!input.all && input.endpoint) {
    query = query.eq("endpoint", input.endpoint);
  } else if (!input.all && input.subscriptionId) {
    query = query.eq("id", input.subscriptionId);
  }

  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }
}

export async function listOperationalPushSubscriptionDevices(input: {
  ownerType: "admin" | "partner";
  ownerId: string;
  currentEndpoint?: string | null;
}): Promise<PushSubscriptionDevice[]> {
  if (input.ownerType === "partner" && isPartnerPortalMock) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const table =
    input.ownerType === "admin" ? "admin_push_subscriptions" : "partner_push_subscriptions";
  const ownerKey = input.ownerType === "admin" ? "admin_id" : "account_id";
  const { data, error } = await supabase
    .from(table)
    .select("id,endpoint,user_agent,created_at,updated_at,last_success_at")
    .eq(ownerKey, input.ownerId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    label: getDeviceLabel(row.user_agent),
    userAgent: row.user_agent ?? null,
    isCurrent: Boolean(input.currentEndpoint && row.endpoint === input.currentEndpoint),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    lastSuccessAt: row.last_success_at ?? null,
  }));
}

async function recordAdminDelivery(input: {
  notificationId: string;
  adminId: string;
  channel: AdminNotificationChannel;
  status: DeliveryStatus;
  errorMessage?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("admin_notification_deliveries").insert({
    notification_id: input.notificationId,
    admin_id: input.adminId,
    channel: input.channel,
    status: input.status,
    error_message: input.errorMessage ?? null,
    delivered_at: input.status === "sent" ? new Date().toISOString() : null,
  });
  if (error) {
    console.error("[operational-notifications] admin delivery log failed", error.message);
  }
}

async function recordPartnerDelivery(input: {
  notificationId: string;
  accountId: string;
  channel: PartnerNotificationChannel;
  status: DeliveryStatus;
  errorMessage?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("partner_notification_deliveries").insert({
    notification_id: input.notificationId,
    account_id: input.accountId,
    channel: input.channel,
    status: input.status,
    error_message: input.errorMessage ?? null,
    delivered_at: input.status === "sent" ? new Date().toISOString() : null,
  });
  if (error) {
    console.error("[operational-notifications] partner delivery log failed", error.message);
  }
}

async function markOperationalPushResult(input: {
  table: "admin_push_subscriptions" | "partner_push_subscriptions";
  id: string;
  ok: boolean;
  errorMessage?: string | null;
  deactivate?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const failedPayload: Record<string, string | boolean | null> = {
    failure_reason: input.errorMessage ?? "푸시 알림 전송 실패",
    last_failure_at: now,
    updated_at: now,
  };
  if (input.deactivate) {
    failedPayload.is_active = false;
  }
  const { error } = await supabase
    .from(input.table)
    .update(
      input.ok
        ? {
            last_success_at: now,
            failure_reason: null,
            last_failure_at: null,
            updated_at: now,
          }
        : failedPayload,
    )
    .eq("id", input.id);
  if (error) {
    console.error("[operational-notifications] push result update failed", error.message);
  }
}

export async function createAdminOperationalNotification(input: {
  type: AdminOperationalNotificationType;
  title: string;
  body: string;
  targetUrl?: string | null;
  metadata?: Record<string, unknown>;
  requestedChannels?: AdminNotificationChannel[];
}) {
  const supabase = getSupabaseAdminClient();
  const targetUrl = toTargetUrl(input.targetUrl, "/admin/notifications");
  const { data: notification, error: notificationError } = await supabase
    .from("admin_notifications")
    .insert({
      type: input.type,
      title: input.title,
      body: input.body,
      target_url: targetUrl,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (notificationError || !notification) {
    throw new Error(notificationError?.message ?? "관리자 알림을 저장하지 못했습니다.");
  }

  const { data: profileRows, error: profileError } = await supabase
    .from("admin_profiles")
    .select("member_id")
    .eq("is_active", true);
  if (profileError) {
    throw new Error(profileError.message);
  }

  const adminIds = Array.from(
    new Set(
      (profileRows ?? [])
        .map((profile) => profile.member_id)
        .filter((memberId): memberId is string => Boolean(memberId)),
    ),
  );
  const { data: preferenceRows, error: preferenceError } = adminIds.length
    ? await supabase
        .from("admin_notification_preferences")
        .select(
          "admin_id,enabled,portal_enabled,push_enabled,security_enabled,partner_request_enabled,expiring_partner_enabled",
        )
        .in("admin_id", adminIds)
    : { data: [], error: null };
  if (preferenceError) {
    throw new Error(preferenceError.message);
  }

  const preferenceByAdminId = new Map(
    (preferenceRows ?? []).map((preference) => [
      preference.admin_id,
      preference,
    ]),
  );
  const admins = adminIds.map((adminId) => ({
    id: adminId,
    channels: resolveAdminNotificationChannels({
      type: input.type,
      requestedChannels: input.requestedChannels ?? [...ADMIN_NOTIFICATION_CHANNELS],
      preferences: toAdminPreferences(
        (preferenceByAdminId.get(adminId) ?? null) as Record<string, unknown> | null,
      ),
    }),
  }));

  const recipientRows = admins
    .filter((admin) => admin.channels.includes("portal"))
    .map((admin) => ({
      notification_id: notification.id,
      admin_id: admin.id,
    }));
  if (recipientRows.length > 0) {
    const { error } = await supabase
      .from("admin_notification_recipients")
      .insert(recipientRows);
    if (error) {
      throw new Error(error.message);
    }
    await Promise.all(
      recipientRows.map((row) =>
        recordAdminDelivery({
          notificationId: notification.id,
          adminId: row.admin_id,
          channel: "portal",
          status: "sent",
        }),
      ),
    );
  }

  const pushTargetAdminIds = admins
    .filter((admin) => admin.channels.includes("push"))
    .map((admin) => admin.id);
  if (pushTargetAdminIds.length > 0) {
    await sendAdminPushDeliveries({
      notificationId: notification.id,
      type: input.type,
      title: input.title,
      body: input.body,
      targetUrl,
      adminIds: pushTargetAdminIds,
    });
  }

  return { notificationId: String(notification.id), recipientCount: recipientRows.length };
}

async function sendAdminPushDeliveries(input: {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  targetUrl: string;
  adminIds: string[];
}) {
  const supabase = getSupabaseAdminClient();
  if (!isPushConfigured()) {
    await Promise.all(
      input.adminIds.map((adminId) =>
        recordAdminDelivery({
          notificationId: input.notificationId,
          adminId,
          channel: "push",
          status: "skipped",
          errorMessage: "Web Push 환경 변수가 설정되지 않았습니다.",
        }),
      ),
    );
    return;
  }

  const { data, error } = await supabase
    .from("admin_push_subscriptions")
    .select("id,admin_id,endpoint,p256dh,auth")
    .in("admin_id", input.adminIds)
    .eq("is_active", true);
  if (error) {
    throw new Error(error.message);
  }
  const webpush = await getWebPush();
  const serialized = toPushPayload({
    type: input.type,
    title: input.title,
    body: input.body,
    targetUrl: input.targetUrl,
    tag: `${input.type}:${input.notificationId}`,
  });

  for (const subscription of data ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          expirationTime: null,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        serialized,
      );
      await markOperationalPushResult({
        table: "admin_push_subscriptions",
        id: subscription.id,
        ok: true,
      });
      await recordAdminDelivery({
        notificationId: input.notificationId,
        adminId: subscription.admin_id,
        channel: "push",
        status: "sent",
      });
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : null;
      const errorMessage = error instanceof Error ? error.message : "푸시 발송 실패";
      await markOperationalPushResult({
        table: "admin_push_subscriptions",
        id: subscription.id,
        ok: false,
        errorMessage,
        deactivate: statusCode === 404 || statusCode === 410,
      });
      await recordAdminDelivery({
        notificationId: input.notificationId,
        adminId: subscription.admin_id,
        channel: "push",
        status: "failed",
        errorMessage,
      });
    }
  }
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
}) {
  const supabase = getSupabaseAdminClient();
  const targetUrl = toTargetUrl(input.targetUrl, "/partner/notifications");
  const { data: notification, error: notificationError } = await supabase
    .from("partner_notifications")
    .insert({
      company_id: input.companyId,
      type: input.type,
      title: input.title,
      body: input.body,
      target_url: targetUrl,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (notificationError || !notification) {
    throw new Error(notificationError?.message ?? "파트너 알림을 저장하지 못했습니다.");
  }

  const accountQuery = supabase
    .from("partner_accounts")
    .select(
      "id,display_name,email,login_id,is_active,preferences:partner_notification_preferences(enabled,portal_enabled,push_enabled,email_enabled,plan_enabled,expiring_partner_enabled,metrics_enabled),links:partner_account_companies!inner(company_id,is_active)",
    )
    .eq("is_active", true);

  const { data: accountRows, error: accountError } =
    input.accountIds && input.accountIds.length > 0
      ? await accountQuery.in("id", input.accountIds)
      : input.companyId
        ? await accountQuery.eq("links.company_id", input.companyId).eq("links.is_active", true)
        : await accountQuery;

  if (accountError) {
    throw new Error(accountError.message);
  }

  const accounts = (accountRows ?? []).map((row) => {
    const preferenceRow = Array.isArray(row.preferences)
      ? row.preferences[0] ?? null
      : row.preferences;
    return {
      id: String(row.id),
      displayName: String(row.display_name ?? "담당자"),
      email: String(row.email ?? row.login_id ?? ""),
      channels: resolvePartnerNotificationChannels({
        type: input.type,
        requestedChannels: input.requestedChannels ?? [...PARTNER_NOTIFICATION_CHANNELS],
        preferences: toPartnerPreferences(preferenceRow as Record<string, unknown> | null),
      }),
    };
  });

  const recipientRows = accounts
    .filter((account) => account.channels.includes("portal"))
    .map((account) => ({
      notification_id: notification.id,
      account_id: account.id,
    }));
  if (recipientRows.length > 0) {
    const { error } = await supabase
      .from("partner_notification_recipients")
      .insert(recipientRows);
    if (error) {
      throw new Error(error.message);
    }
    await Promise.all(
      recipientRows.map((row) =>
        recordPartnerDelivery({
          notificationId: notification.id,
          accountId: row.account_id,
          channel: "portal",
          status: "sent",
        }),
      ),
    );
  }

  const emailTargets = accounts.filter((account) => account.channels.includes("email"));
  await Promise.all(
    emailTargets.map(async (account) => {
      try {
        await sendPartnerOperationalNotificationEmail({
          to: account.email,
          displayName: account.displayName,
          title: input.title,
          body: input.body,
          targetUrl,
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
          errorMessage: error instanceof Error ? error.message : "이메일 발송 설정이 없습니다.",
        });
      }
    }),
  );

  const pushTargetAccountIds = accounts
    .filter((account) => account.channels.includes("push"))
    .map((account) => account.id);
  if (pushTargetAccountIds.length > 0) {
    await sendPartnerPushDeliveries({
      notificationId: notification.id,
      type: input.type,
      title: input.title,
      body: input.body,
      targetUrl,
      accountIds: pushTargetAccountIds,
    });
  }

  return { notificationId: String(notification.id), recipientCount: recipientRows.length };
}

async function sendPartnerPushDeliveries(input: {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  targetUrl: string;
  accountIds: string[];
}) {
  const supabase = getSupabaseAdminClient();
  if (!isPushConfigured()) {
    await Promise.all(
      input.accountIds.map((accountId) =>
        recordPartnerDelivery({
          notificationId: input.notificationId,
          accountId,
          channel: "push",
          status: "skipped",
          errorMessage: "Web Push 환경 변수가 설정되지 않았습니다.",
        }),
      ),
    );
    return;
  }

  const { data, error } = await supabase
    .from("partner_push_subscriptions")
    .select("id,account_id,endpoint,p256dh,auth")
    .in("account_id", input.accountIds)
    .eq("is_active", true);
  if (error) {
    throw new Error(error.message);
  }
  const webpush = await getWebPush();
  const serialized = toPushPayload({
    type: input.type,
    title: input.title,
    body: input.body,
    targetUrl: input.targetUrl,
    tag: `${input.type}:${input.notificationId}`,
  });

  for (const subscription of data ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          expirationTime: null,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        serialized,
      );
      await markOperationalPushResult({
        table: "partner_push_subscriptions",
        id: subscription.id,
        ok: true,
      });
      await recordPartnerDelivery({
        notificationId: input.notificationId,
        accountId: subscription.account_id,
        channel: "push",
        status: "sent",
      });
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : null;
      const errorMessage = error instanceof Error ? error.message : "푸시 발송 실패";
      await markOperationalPushResult({
        table: "partner_push_subscriptions",
        id: subscription.id,
        ok: false,
        errorMessage,
        deactivate: statusCode === 404 || statusCode === 410,
      });
      await recordPartnerDelivery({
        notificationId: input.notificationId,
        accountId: subscription.account_id,
        channel: "push",
        status: "failed",
        errorMessage,
      });
    }
  }
}

export async function claimOperationalNotificationDedupe(input: {
  dedupeKey: string;
  audience: "admin" | "partner";
  notificationType: string;
  targetId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("operational_notification_dedupes").insert({
    dedupe_key: input.dedupeKey,
    audience: input.audience,
    notification_type: input.notificationType,
    target_id: input.targetId,
  });

  if (!error) {
    return true;
  }
  if (error.code === "23505") {
    return false;
  }
  throw new Error(error.message);
}
