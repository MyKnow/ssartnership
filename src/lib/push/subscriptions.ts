import { getSupabaseAdminClient } from "../supabase/server.ts";
import { sanitizeHttpUrl } from "../validation.ts";
import { wrapPushDbError } from "./config.ts";
import { PushError } from "./types.ts";
import type { SubscriptionInput } from "./types.ts";
import {
  getMemberPushPreferences,
  upsertMemberPushPreferences,
} from "./preferences.ts";

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
  });
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
    throw wrapPushDbError(error, "Push 구독을 비활성화하지 못했습니다.");
  }

  return getMemberPushPreferences(memberId);
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
