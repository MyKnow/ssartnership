import { getSupabaseAdminClient } from "../supabase/server.ts";
import { sanitizeHttpUrl } from "../validation.ts";
import { wrapPushDbError } from "./config.ts";
import { PushError } from "./types.ts";
import type { SubscriptionInput } from "./types.ts";
import {
  getMemberPushPreferences,
  upsertMemberPushPreferences,
} from "./preferences.ts";

export type PushSubscriptionDevice = {
  id: string;
  label: string;
  userAgent: string | null;
  isCurrent: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastSuccessAt: string | null;
};

function validateSubscription(input: SubscriptionInput) {
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
    throw wrapPushDbError(error, "Push 구독 정보를 저장하지 못했습니다.");
  }

  return upsertMemberPushPreferences(memberId, {
    enabled: true,
    announcementEnabled: true,
    newPartnerEnabled: true,
    expiringPartnerEnabled: true,
    reviewEnabled: true,
  });
}

export async function deactivatePushSubscription(params: {
  memberId: string;
  endpoint?: string | null;
  subscriptionId?: string | null;
}) {
  const { memberId, endpoint, subscriptionId } = params;
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
  } else if (subscriptionId) {
    query = query.eq("id", subscriptionId);
  }

  const { error } = await query;
  if (error) {
    throw wrapPushDbError(error, "Push 구독을 비활성화하지 못했습니다.");
  }

  return getMemberPushPreferences(memberId);
}

function getDeviceLabel(userAgent: string | null) {
  const source = userAgent ?? "";
  const clientHints = source.includes("client-hints=")
    ? source.slice(source.indexOf("client-hints="))
    : "";
  const browser =
    clientHints.includes("Microsoft Edge") || source.includes("Edg/")
      ? "Edge"
      : clientHints.includes("Google Chrome") ||
          clientHints.includes("Chromium") ||
          source.includes("Chrome/")
        ? "Chrome"
      : source.includes("Firefox/")
        ? "Firefox"
        : source.includes("Safari/") && !clientHints
          ? "Safari"
          : "브라우저";
  const os =
    clientHints.includes("macOS") ||
    source.includes("Mac OS X") ||
    source.includes("macOS") ||
    source.includes("Macintosh")
      ? "macOS"
      : clientHints.includes("Windows") || source.includes("Windows")
        ? "Windows"
        : clientHints.includes("Android") || source.includes("Android")
          ? "Android"
          : source.includes("iPhone") || source.includes("iPad") || source.includes("iOS")
            ? "iOS"
            : source.includes("Linux")
              ? "Linux"
              : "기기";

  return `${browser} · ${os}`;
}

export async function listPushSubscriptionDevices(params: {
  memberId: string;
  currentEndpoint?: string | null;
}): Promise<PushSubscriptionDevice[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, user_agent, created_at, updated_at, last_success_at")
    .eq("member_id", params.memberId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw wrapPushDbError(error, "Push 기기 목록을 불러오지 못했습니다.");
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    label: getDeviceLabel(row.user_agent),
    userAgent: row.user_agent ?? null,
    isCurrent: Boolean(params.currentEndpoint && row.endpoint === params.currentEndpoint),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    lastSuccessAt: row.last_success_at ?? null,
  }));
}

export async function deactivateAllPushSubscriptions(memberId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("member_id", memberId);

  if (error) {
    throw wrapPushDbError(error, "Push 구독을 비활성화하지 못했습니다.");
  }

  return upsertMemberPushPreferences(memberId, { enabled: false });
}
