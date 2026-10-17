import { getPushDeviceLabel } from "@/lib/push/device-label";
import { normalizeUserAgentHeader } from "@/lib/request-header-values";
import { validateTrustedPushSubscription } from "@/lib/push/subscription-trust";
import type { SubscriptionInput } from "@/lib/push/types";
import { isPartnerPortalMock } from "@/lib/partner-auth/portal";
import {
  upsertAdminOperationalNotificationPreferences,
  upsertPartnerOperationalNotificationPreferences,
} from "./preferences";
import {
  savePushSubscription,
  deactivatePushSubscription,
  listPushSubscriptionDevices,
  countPushSubscriptionDevices,
} from "./repository.supabase";
import type { PushSubscriptionDevice } from "./types";

export async function upsertOperationalPushSubscription(input: {
  ownerType: "admin" | "partner";
  ownerId: string;
  subscription: SubscriptionInput;
  userAgent?: string | null;
}) {
  if (input.ownerType === "partner" && isPartnerPortalMock) {
    return upsertPartnerOperationalNotificationPreferences(input.ownerId, {
      enabled: true,
      pushEnabled: true,
    });
  }

  const validated = await validateTrustedPushSubscription(input.subscription);

  await savePushSubscription({ ...input, userAgent: normalizeUserAgentHeader(input.userAgent) }, validated);

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

  await deactivatePushSubscription(input);
}

export async function listOperationalPushSubscriptionDevices(input: {
  ownerType: "admin" | "partner";
  ownerId: string;
  currentEndpoint?: string | null;
}): Promise<PushSubscriptionDevice[]> {
  if (input.ownerType === "partner" && isPartnerPortalMock) {
    return [];
  }

  const data = await listPushSubscriptionDevices(input);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    label: getPushDeviceLabel(row.userAgent),
    userAgent: row.userAgent,
    isCurrent: Boolean(
      input.currentEndpoint && row.endpoint === input.currentEndpoint,
    ),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastSuccessAt: row.lastSuccessAt,
  }));
}

export async function countOperationalPushSubscriptionDevices(input: {
  ownerType: "admin" | "partner";
  ownerId: string;
}) {
  if (input.ownerType === "partner" && isPartnerPortalMock) {
    return 0;
  }

  return countPushSubscriptionDevices(input);
}
