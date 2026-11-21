import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/server-log";
import type {
  AdminNotificationChannel,
  PartnerNotificationChannel,
  AdminNotificationPreferenceState,
  PartnerNotificationPreferenceState,
} from "@/lib/partner-notification-routing";
import type { ValidatedPushSubscription } from "@/lib/push/subscription-trust";
import type { DeliveryStatus, OperationalNotificationDedupeInput } from "./types";

import { toAdminPreferences, toPartnerPreferences } from "./preference-state";

type Client = ReturnType<typeof getSupabaseAdminClient>;

export async function recordAdminDelivery(input: {
  notificationId: string;
  adminId: string;
  channel: AdminNotificationChannel;
  status: DeliveryStatus;
  errorMessage?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("admin_notification_deliveries")
    .insert({
      notification_id: input.notificationId,
      admin_id: input.adminId,
      channel: input.channel,
      status: input.status,
      error_message: input.errorMessage ?? null,
      delivered_at: input.status === "sent" ? new Date().toISOString() : null,
    });
  if (error) {
    logServerError("[operational-notifications] admin delivery log failed", error);
  }
}

export async function recordPartnerDelivery(input: {
  notificationId: string;
  accountId: string;
  channel: PartnerNotificationChannel;
  status: DeliveryStatus;
  errorMessage?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("partner_notification_deliveries")
    .insert({
      notification_id: input.notificationId,
      account_id: input.accountId,
      channel: input.channel,
      status: input.status,
      error_message: input.errorMessage ?? null,
      delivered_at: input.status === "sent" ? new Date().toISOString() : null,
    });
  if (error) {
    logServerError("[operational-notifications] partner delivery log failed", error);
  }
}

export async function markOperationalPushResult(input: {
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
    logServerError("[operational-notifications] push result update failed", error);
  }
}

export async function claimOperationalNotificationDedupe(
  input: OperationalNotificationDedupeInput,
) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("operational_notification_dedupes")
    .insert({
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

export async function releaseOperationalNotificationDedupe(
  input: OperationalNotificationDedupeInput,
) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("operational_notification_dedupes")
    .delete()
    .eq("dedupe_key", input.dedupeKey)
    .eq("audience", input.audience)
    .eq("notification_type", input.notificationType)
    .eq("target_id", input.targetId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function readAdminPreferences(adminId: string) {
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

export async function saveAdminPreferences(adminId: string, next: AdminNotificationPreferenceState) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("admin_notification_preferences")
    .upsert(
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
}

export async function readPartnerPreferences(accountId: string) {
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

export async function savePartnerPreferences(accountId: string, next: PartnerNotificationPreferenceState) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("partner_notification_preferences")
    .upsert(
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
}

export async function savePushSubscription(input: {
  ownerType: "admin" | "partner"; ownerId: string; userAgent: string | null;
}, validated: ValidatedPushSubscription) {
  const supabase = getSupabaseAdminClient();
  const table =
    input.ownerType === "admin"
      ? "admin_push_subscriptions"
      : "partner_push_subscriptions";
  const ownerKey = input.ownerType === "admin" ? "admin_id" : "account_id";
  const { error } = await supabase.from(table).upsert(
    {
      [ownerKey]: input.ownerId,
      endpoint: validated.endpoint,
      p256dh: validated.p256dh,
      auth: validated.auth,
      expiration_time: validated.expirationTime,
      user_agent: input.userAgent,
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

}

export async function deactivatePushSubscription(input: {
  ownerType: "admin" | "partner"; ownerId: string; endpoint?: string | null;
  subscriptionId?: string | null; all?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const table =
    input.ownerType === "admin"
      ? "admin_push_subscriptions"
      : "partner_push_subscriptions";
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

export async function listPushSubscriptionDevices(input: { ownerType: "admin" | "partner"; ownerId: string }) {
  const supabase = getSupabaseAdminClient();
  const table =
    input.ownerType === "admin"
      ? "admin_push_subscriptions"
      : "partner_push_subscriptions";
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
    endpoint: String(row.endpoint),
    userAgent: row.user_agent ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    lastSuccessAt: row.last_success_at ?? null,
  }));
}

export async function countPushSubscriptionDevices(input: { ownerType: "admin" | "partner"; ownerId: string }) {
  const supabase = getSupabaseAdminClient();
  const table =
    input.ownerType === "admin"
      ? "admin_push_subscriptions"
      : "partner_push_subscriptions";
  const ownerKey = input.ownerType === "admin" ? "admin_id" : "account_id";
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(ownerKey, input.ownerId)
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function insertAdminNotification(supabase: Client, payload: {
  type: string; title: string; body: string; target_url: string; metadata: Record<string, unknown>;
}) {
  const { data: notification, error: notificationError } = await supabase
    .from("admin_notifications")
    .insert(payload)
    .select("id")
    .single();

  if (notificationError || !notification) {
    throw new Error(
      notificationError?.message ?? "관리자 알림을 저장하지 못했습니다.",
    );
  }

  return notification;
}

export async function insertAdminRecipients(supabase: Client, recipientRows: Array<{ notification_id: string; admin_id: string }>) {
  const { error } = await supabase
    .from("admin_notification_recipients")
    .insert(recipientRows);
  if (error) {
    throw new Error(error.message);
  }
}

export async function insertPartnerNotification(supabase: Client, payload: {
  type: string; title: string; body: string; target_url: string; metadata: Record<string, unknown>; company_id: string | null;
}) {
  const { data: notification, error: notificationError } = await supabase
    .from("partner_notifications")
    .insert(payload)
    .select("id")
    .single();

  if (notificationError || !notification) {
    throw new Error(
      notificationError?.message ?? "파트너 알림을 저장하지 못했습니다.",
    );
  }

  return notification;
}

export async function insertPartnerRecipients(supabase: Client, recipientRows: Array<{ notification_id: string; account_id: string }>) {
  const { error } = await supabase
    .from("partner_notification_recipients")
    .insert(recipientRows);
  if (error) {
    throw new Error(error.message);
  }
}

export async function listAdminNotificationPreferences(supabase: Client, adminIds: string[]) {
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

  return (preferenceRows ?? []).map((row) => ({
    adminId: String(row.admin_id),
    preferences: toAdminPreferences(row as Record<string, unknown>),
  }));
}

export async function listPartnerNotificationAccounts(supabase: Client, input: { accountIds?: string[]; companyId: string | null }) {
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
        ? await accountQuery
          .eq("links.company_id", input.companyId)
          .eq("links.is_active", true)
        : await accountQuery;

  if (accountError) {
    throw new Error(accountError.message);
  }

  return (accountRows ?? []).map((row) => ({
    id: String(row.id),
    displayName: String(row.display_name ?? "담당자"),
    email: String(row.email ?? row.login_id ?? ""),
    preferences: toPartnerPreferences(
      (Array.isArray(row.preferences) ? row.preferences[0] ?? null : row.preferences) as Record<string, unknown> | null,
    ),
  }));
}

export async function deleteOperationalNotification(supabase: Client, audience: "admin" | "partner", notificationId: string) {
  const table = audience === "admin" ? "admin_notifications" : "partner_notifications";
  const { error } = await supabase.from(table).delete().eq("id", notificationId);
  if (error) throw new Error(error.message);
}

export async function listActivePushSubscriptions(input: {
  subscriptionTable: "admin_push_subscriptions" | "partner_push_subscriptions";
  ownerColumn: "admin_id" | "account_id"; ownerIds: string[];
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(input.subscriptionTable)
    .select(`id,${input.ownerColumn},endpoint,p256dh,auth`)
    .in(input.ownerColumn, input.ownerIds)
    .eq("is_active", true);
  if (error) {
    throw new Error(error.message);
  }
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  } & Partial<Record<"admin_id" | "account_id", string>>>;
  return rows.map((row) => ({
    id: String(row.id),
    ownerId: String(row[input.ownerColumn] ?? ""),
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
  }));
}
