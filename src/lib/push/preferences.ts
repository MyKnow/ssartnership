import { getSupabaseAdminClient } from "../supabase/server.ts";
import { isMockDataSource } from "../mock/member.ts";
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
    reviewEnabled: value?.reviewEnabled ?? DEFAULT_PUSH_PREFERENCES.reviewEnabled,
    mmEnabled: value?.mmEnabled ?? DEFAULT_PUSH_PREFERENCES.mmEnabled,
    marketingEnabled:
      value?.marketingEnabled ?? DEFAULT_PUSH_PREFERENCES.marketingEnabled,
  };
}

export async function getMemberPushPreferences(memberId: string) {
  if (isMockDataSource()) {
    return getPushPreferencesOrDefault();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("push_preferences")
    .select(
      "enabled,announcement_enabled,new_partner_enabled,expiring_partner_enabled,review_enabled,mm_enabled,marketing_enabled",
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
          reviewEnabled: data.review_enabled,
          mmEnabled: data.mm_enabled,
          marketingEnabled: data.marketing_enabled,
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
    reviewEnabled:
      value?.reviewEnabled ??
      ACTIVE_SUBSCRIPTION_FALLBACK_PREFERENCES.reviewEnabled,
    mmEnabled: value?.mmEnabled ?? ACTIVE_SUBSCRIPTION_FALLBACK_PREFERENCES.mmEnabled,
    marketingEnabled:
      value?.marketingEnabled ??
      ACTIVE_SUBSCRIPTION_FALLBACK_PREFERENCES.marketingEnabled,
  };
}

/** Device lifecycle writers share the consent-safe patch boundary. */
export async function upsertMemberPushPreferences(
  memberId: string,
  value: Partial<PushPreferenceState>,
): Promise<PushPreferenceState> {
  const { updateMemberNotificationPreferences } = await import("../notification-preferences.ts");
  return updateMemberNotificationPreferences(memberId, value);
}
