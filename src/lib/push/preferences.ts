import { getSupabaseAdminClient } from "../supabase/server.ts";
import { isMissingPushTableError, wrapPushDbError } from "./config.ts";
import {
  ACTIVE_SUBSCRIPTION_FALLBACK_PREFERENCES,
  DEFAULT_PUSH_PREFERENCES,
} from "./types.ts";
import type { PushPreferenceState } from "./types.ts";

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
    throw wrapPushDbError(error, "Push 설정을 불러오지 못했습니다.");
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

export function getActiveSubscriptionPushPreferences(
  value?: Partial<PushPreferenceState> | null,
): PushPreferenceState {
  return {
    enabled: value?.enabled ?? ACTIVE_SUBSCRIPTION_FALLBACK_PREFERENCES.enabled,
    announcementEnabled:
      value?.announcementEnabled ??
      ACTIVE_SUBSCRIPTION_FALLBACK_PREFERENCES.announcementEnabled,
    newPartnerEnabled:
      value?.newPartnerEnabled ??
      ACTIVE_SUBSCRIPTION_FALLBACK_PREFERENCES.newPartnerEnabled,
    expiringPartnerEnabled:
      value?.expiringPartnerEnabled ??
      ACTIVE_SUBSCRIPTION_FALLBACK_PREFERENCES.expiringPartnerEnabled,
  };
}

export async function upsertMemberPushPreferences(
  memberId: string,
  value: Partial<PushPreferenceState>,
) {
  const current = await getMemberPushPreferences(memberId);
  const next: PushPreferenceState = {
    enabled: value.enabled ?? current.enabled,
    announcementEnabled:
      value.announcementEnabled ?? current.announcementEnabled,
    newPartnerEnabled: value.newPartnerEnabled ?? current.newPartnerEnabled,
    expiringPartnerEnabled:
      value.expiringPartnerEnabled ?? current.expiringPartnerEnabled,
  };
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
    throw wrapPushDbError(error, "Push 설정을 저장하지 못했습니다.");
  }

  return next;
}
