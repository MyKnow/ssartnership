import {
  getDefaultAdminNotificationPreferences,
  getDefaultPartnerNotificationPreferences,
  type AdminNotificationPreferenceState,
  type PartnerNotificationPreferenceState,
} from "@/lib/partner-notification-routing";

export function toAdminPreferences(row: Record<string, unknown> | null | undefined) {
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

export function toPartnerPreferences(row: Record<string, unknown> | null | undefined) {
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
