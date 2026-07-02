export const ADMIN_NOTIFICATION_CHANNELS = ["portal", "push"] as const;
export const PARTNER_NOTIFICATION_CHANNELS = ["portal", "push", "email"] as const;

export type AdminNotificationChannel = (typeof ADMIN_NOTIFICATION_CHANNELS)[number];
export type PartnerNotificationChannel = (typeof PARTNER_NOTIFICATION_CHANNELS)[number];

export type AdminOperationalNotificationType =
  | "partner_change_request"
  | "partner_immediate_update"
  | "expiring_partner"
  | "security_alert";

export type PartnerOperationalNotificationType =
  | "expiring_partner"
  | "plan_changed"
  | "plan_upgrade_requested"
  | "plan_upgrade_approved"
  | "plan_upgrade_rejected"
  | "metrics_digest";

export type AdminNotificationPreferenceState = {
  enabled: boolean;
  portalEnabled: boolean;
  pushEnabled: boolean;
  securityEnabled: boolean;
  partnerRequestEnabled: boolean;
  expiringPartnerEnabled: boolean;
};

export type PartnerNotificationPreferenceState = {
  enabled: boolean;
  portalEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  planEnabled: boolean;
  expiringPartnerEnabled: boolean;
  metricsEnabled: boolean;
};

const DEFAULT_ADMIN_NOTIFICATION_PREFERENCES: AdminNotificationPreferenceState = {
  enabled: true,
  portalEnabled: true,
  pushEnabled: true,
  securityEnabled: true,
  partnerRequestEnabled: true,
  expiringPartnerEnabled: true,
};

const DEFAULT_PARTNER_NOTIFICATION_PREFERENCES: PartnerNotificationPreferenceState = {
  enabled: true,
  portalEnabled: true,
  pushEnabled: true,
  emailEnabled: true,
  planEnabled: true,
  expiringPartnerEnabled: true,
  metricsEnabled: true,
};

export function getDefaultAdminNotificationPreferences() {
  return { ...DEFAULT_ADMIN_NOTIFICATION_PREFERENCES };
}

export function getDefaultPartnerNotificationPreferences() {
  return { ...DEFAULT_PARTNER_NOTIFICATION_PREFERENCES };
}

function uniqueChannels<T extends string>(channels: readonly T[]) {
  return [...new Set(channels)];
}

function isAdminTypeEnabled(
  type: AdminOperationalNotificationType,
  preferences: AdminNotificationPreferenceState,
) {
  switch (type) {
    case "security_alert":
      return preferences.securityEnabled;
    case "expiring_partner":
      return preferences.expiringPartnerEnabled;
    case "partner_change_request":
    case "partner_immediate_update":
      return preferences.partnerRequestEnabled;
  }
}

function isPartnerTypeEnabled(
  type: PartnerOperationalNotificationType,
  preferences: PartnerNotificationPreferenceState,
) {
  switch (type) {
    case "expiring_partner":
      return preferences.expiringPartnerEnabled;
    case "metrics_digest":
      return preferences.metricsEnabled;
    case "plan_changed":
    case "plan_upgrade_requested":
    case "plan_upgrade_approved":
    case "plan_upgrade_rejected":
      return preferences.planEnabled;
  }
}

export function resolveAdminNotificationChannels(input: {
  type: AdminOperationalNotificationType;
  requestedChannels: AdminNotificationChannel[];
  preferences?: AdminNotificationPreferenceState | null;
}) {
  const preferences = input.preferences ?? DEFAULT_ADMIN_NOTIFICATION_PREFERENCES;
  if (input.type === "security_alert" && !preferences.enabled) {
    return ["portal"] satisfies AdminNotificationChannel[];
  }
  if (!preferences.enabled || !isAdminTypeEnabled(input.type, preferences)) {
    return [] satisfies AdminNotificationChannel[];
  }

  return uniqueChannels(input.requestedChannels).filter((channel) => {
    if (channel === "portal") {
      return preferences.portalEnabled;
    }
    return preferences.pushEnabled;
  });
}

export function resolvePartnerNotificationChannels(input: {
  type?: PartnerOperationalNotificationType;
  requestedChannels: PartnerNotificationChannel[];
  preferences?: PartnerNotificationPreferenceState | null;
}) {
  const preferences = input.preferences ?? DEFAULT_PARTNER_NOTIFICATION_PREFERENCES;
  if (!preferences.enabled) {
    return [] satisfies PartnerNotificationChannel[];
  }
  if (input.type && !isPartnerTypeEnabled(input.type, preferences)) {
    return [] satisfies PartnerNotificationChannel[];
  }

  return uniqueChannels(input.requestedChannels).filter((channel) => {
    switch (channel) {
      case "portal":
        return preferences.portalEnabled;
      case "push":
        return preferences.pushEnabled;
      case "email":
        return preferences.emailEnabled;
    }
  });
}

export function getExpiringPartnershipOffsets() {
  return [30, 7, 1] as const;
}

export function createExpiringPartnershipDedupeKey(input: {
  audience: "admin" | "partner";
  partnerId: string;
  daysBefore: number;
  endDate: string;
}) {
  return [
    "expiring-partnership",
    input.audience,
    input.partnerId,
    input.daysBefore,
    input.endDate,
  ].join(":");
}
