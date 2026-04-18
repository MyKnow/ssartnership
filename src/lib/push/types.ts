export const DEFAULT_PUSH_PREFERENCES = {
  enabled: false,
  announcementEnabled: true,
  newPartnerEnabled: true,
  expiringPartnerEnabled: true,
  reviewEnabled: true,
  mmEnabled: true,
  marketingEnabled: false,
} as const;

export const ACTIVE_SUBSCRIPTION_FALLBACK_PREFERENCES = {
  enabled: true,
  announcementEnabled: true,
  newPartnerEnabled: true,
  expiringPartnerEnabled: true,
  reviewEnabled: true,
  mmEnabled: true,
  marketingEnabled: false,
} as const;

export type PushPreferenceState = {
  enabled: boolean;
  announcementEnabled: boolean;
  newPartnerEnabled: boolean;
  expiringPartnerEnabled: boolean;
  reviewEnabled: boolean;
  mmEnabled: boolean;
  marketingEnabled: boolean;
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

export type PushAudienceScope = "all" | "year" | "campus" | "member";

export type PushAudience =
  | { scope: "all" }
  | { scope: "year"; year: number }
  | { scope: "campus"; campus: string }
  | { scope: "member"; memberId: string };

export type PushMessageLog = {
  id: string;
  type: PushNotificationType;
  source: "manual" | "automatic";
  target_scope: PushAudienceScope;
  target_label: string;
  target_year: number | null;
  target_campus: string | null;
  target_member_id: string | null;
  title: string;
  body: string;
  url: string | null;
  status: "pending" | "sent" | "partial_failed" | "failed" | "no_target";
  targeted: number;
  delivered: number;
  failed: number;
  created_at: string;
  completed_at: string | null;
};

export type PushErrorCode =
  | "config_missing"
  | "invalid_request"
  | "db_error"
  | "not_found"
  | "push_unavailable";

export class PushError extends Error {
  code: PushErrorCode;

  constructor(code: PushErrorCode, message: string) {
    super(message);
    this.name = "PushError";
    this.code = code;
  }
}

export type PushSendOptions = {
  source?: "manual" | "automatic";
  audience?: PushAudience;
};

export type ResolvedPushAudience = {
  scope: PushAudienceScope;
  label: string;
  year: number | null;
  campus: string | null;
  memberId: string | null;
  memberIds: string[] | null;
};

export type SubscriptionInput = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export type StoredSubscription = {
  id: string;
  member_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type DeliveryResult = {
  targeted: number;
  delivered: number;
  failed: number;
};

export type WebPushModule = typeof import("web-push");
