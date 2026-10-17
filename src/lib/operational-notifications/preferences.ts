import {
  getDefaultPartnerNotificationPreferences,
  type AdminNotificationPreferenceState,
  type PartnerNotificationPreferenceState,
} from "@/lib/partner-notification-routing";
import { isPartnerPortalMock } from "@/lib/partner-auth/portal";
import {
  readAdminPreferences,
  readPartnerPreferences,
  saveAdminPreferences,
  savePartnerPreferences,
} from "./repository.supabase";

export async function getAdminOperationalNotificationPreferences(
  adminId: string,
) {
  return readAdminPreferences(adminId);
}

export async function getPartnerOperationalNotificationPreferences(
  accountId: string,
) {
  if (isPartnerPortalMock) {
    return getDefaultPartnerNotificationPreferences();
  }

  return readPartnerPreferences(accountId);
}

export async function upsertAdminOperationalNotificationPreferences(
  adminId: string,
  preferences: Partial<AdminNotificationPreferenceState>,
) {
  const current = await getAdminOperationalNotificationPreferences(adminId);
  const next = { ...current, ...preferences };
  await saveAdminPreferences(adminId, next);
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
  await savePartnerPreferences(accountId, next);
  return next;
}
