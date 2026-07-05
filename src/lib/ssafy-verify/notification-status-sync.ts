import {
  getSsafyVerifyServerApiConfig,
  isSsafyVerifyServerApiConfigured,
} from "@/lib/ssafy-verify/config";
import { createSsafyVerifyApiTraceLogger } from "@/lib/ssafy-verify/api-trace";
import {
  createSsafyVerifyServerApiClient,
  type SsafyVerifyNotificationResult,
  type SsafyVerifyNotificationTargetResult,
} from "@/lib/ssafy-verify/server-api";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { NotificationDeliveryStatus } from "@/lib/notifications/shared";

type DeliveryRow = {
  id: string;
  notification_id: string;
  member_id: string | null;
  status: NotificationDeliveryStatus;
  error_message: string | null;
  delivered_at: string | null;
  provider_notification_id: string | null;
  provider_campaign_id: string | null;
  provider_idempotency_key: string | null;
  provider_status: string | null;
};

type NotificationMetadataRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

export type SsafyVerifyNotificationStatusSyncResult = {
  configured: boolean;
  checked: number;
  updated: number;
  skipped: number;
  campaigns: number;
  failedCampaigns: number;
};

const DEFAULT_SYNC_LIMIT = 100;
const MAX_SYNC_LIMIT = 500;
const SYNCABLE_DELIVERY_STATUSES: NotificationDeliveryStatus[] = [
  "pending",
  "sent",
  "failed",
];

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function toLocalVerifyNotificationDeliveryStatus(
  status: string | null | undefined,
): NotificationDeliveryStatus {
  const normalized = normalizeStatus(status);
  if (
    normalized === "sent" ||
    normalized === "delivered" ||
    normalized === "success" ||
    normalized === "succeeded"
  ) {
    return "sent";
  }
  if (
    normalized === "failed" ||
    normalized === "failure" ||
    normalized === "rejected" ||
    normalized === "bounced"
  ) {
    return "failed";
  }
  if (normalized === "skipped" || normalized === "cancelled") {
    return "skipped";
  }
  return "pending";
}

export function findVerifyNotificationTargetResult(
  row: Pick<
    DeliveryRow,
    "provider_idempotency_key" | "provider_notification_id"
  >,
  result: SsafyVerifyNotificationResult,
) {
  if (row.provider_idempotency_key) {
    const byIdempotencyKey = result.results.find(
      (item) => item.idempotencyKey === row.provider_idempotency_key,
    );
    if (byIdempotencyKey) {
      return byIdempotencyKey;
    }
  }

  if (row.provider_notification_id) {
    const byNotificationId = result.results.find(
      (item) => item.notificationId === row.provider_notification_id,
    );
    if (byNotificationId) {
      return byNotificationId;
    }
  }

  return result.results.length === 1 ? result.results[0] ?? null : null;
}

function limitSyncSize(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SYNC_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(value), 1), MAX_SYNC_LIMIT);
}

function getTargetErrorMessage(
  target: SsafyVerifyNotificationTargetResult | null,
  status: NotificationDeliveryStatus,
) {
  if (status !== "failed") {
    return null;
  }
  if (!target?.errorCode && !target?.errorMessage && !target?.requestId) {
    return "SSAFY Verify 알림 발송 실패";
  }
  const code = target.errorCode ?? "VERIFY_NOTIFICATION_FAILED";
  const message = target.errorMessage ?? "SSAFY Verify 알림 발송 실패";
  const requestSuffix = target.requestId ? ` (request_id: ${target.requestId})` : "";
  return `${code}: ${message}${requestSuffix}`;
}

function groupByCampaign(rows: DeliveryRow[]) {
  const grouped = new Map<string, DeliveryRow[]>();
  for (const row of rows) {
    const campaignId = row.provider_campaign_id ?? row.notification_id;
    const current = grouped.get(campaignId) ?? [];
    current.push(row);
    grouped.set(campaignId, current);
  }
  return grouped;
}

function createMetadataSummary(input: {
  syncedAt: string;
  checked: number;
  updated: number;
  statuses: Record<NotificationDeliveryStatus, number>;
}) {
  return {
    provider: "ssafy_verify",
    syncedAt: input.syncedAt,
    checked: input.checked,
    updated: input.updated,
    statuses: input.statuses,
  };
}

export async function runSsafyVerifyNotificationStatusSync(input: {
  limit?: number | null;
} = {}): Promise<SsafyVerifyNotificationStatusSyncResult> {
  if (!isSsafyVerifyServerApiConfigured()) {
    return {
      configured: false,
      checked: 0,
      updated: 0,
      skipped: 0,
      campaigns: 0,
      failedCampaigns: 0,
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("notification_deliveries")
    .select(
      [
        "id",
        "notification_id",
        "member_id",
        "status",
        "error_message",
        "delivered_at",
        "provider_notification_id",
        "provider_campaign_id",
        "provider_idempotency_key",
        "provider_status",
      ].join(","),
    )
    .eq("provider", "ssafy_verify")
    .eq("channel", "mm")
    .in("status", SYNCABLE_DELIVERY_STATUSES)
    .order("created_at", { ascending: false })
    .limit(limitSyncSize(input.limit));

  if (error) {
    throw new Error(error.message);
  }

  const queriedRows = (data ?? []) as unknown as DeliveryRow[];
  const rows = queriedRows.filter(
    (row) => row.provider_campaign_id || row.provider_notification_id,
  );
  if (rows.length === 0) {
    return {
      configured: true,
      checked: 0,
      updated: 0,
      skipped: queriedRows.length,
      campaigns: 0,
      failedCampaigns: 0,
    };
  }

  const client = createSsafyVerifyServerApiClient(getSsafyVerifyServerApiConfig(), {
    trace: createSsafyVerifyApiTraceLogger({
      actorType: "system",
      identifier: "ssafy-verify-notification-status-sync",
      properties: {
        flow: "ssafy_verify_notification_status_sync",
        limit: limitSyncSize(input.limit),
      },
    }),
  });

  const now = new Date().toISOString();
  let checked = 0;
  let updated = 0;
  let failedCampaigns = 0;
  const notificationStatusCounts = new Map<
    string,
    Record<NotificationDeliveryStatus, number>
  >();
  const notificationCheckedCounts = new Map<string, number>();
  const notificationUpdatedCounts = new Map<string, number>();

  for (const [campaignId, campaignRows] of groupByCampaign(rows)) {
    let campaignResult: SsafyVerifyNotificationResult;
    try {
      campaignResult = await client.listNotifications({ campaignId });
    } catch (error) {
      failedCampaigns += 1;
      console.error(
        "[ssafy-verify-notification-status-sync] campaign status failed",
        error,
      );
      continue;
    }

    for (const row of campaignRows) {
      checked += 1;
      notificationCheckedCounts.set(
        row.notification_id,
        (notificationCheckedCounts.get(row.notification_id) ?? 0) + 1,
      );
      const target = findVerifyNotificationTargetResult(row, campaignResult);
      const providerStatus = target?.status ?? campaignResult.status;
      const nextStatus = toLocalVerifyNotificationDeliveryStatus(providerStatus);
      const nextErrorMessage = getTargetErrorMessage(target, nextStatus);
      const nextProviderNotificationId =
        target?.notificationId ?? row.provider_notification_id;
      const shouldUpdate =
        row.status !== nextStatus ||
        row.provider_status !== providerStatus ||
        row.error_message !== nextErrorMessage ||
        row.provider_notification_id !== nextProviderNotificationId;

      const statusCounts =
        notificationStatusCounts.get(row.notification_id) ??
        { pending: 0, sent: 0, failed: 0, skipped: 0 };
      statusCounts[nextStatus] += 1;
      notificationStatusCounts.set(row.notification_id, statusCounts);

      if (!shouldUpdate) {
        continue;
      }

      const { error: updateError } = await supabase
        .from("notification_deliveries")
        .update({
          status: nextStatus,
          error_message: nextErrorMessage,
          provider_status: providerStatus,
          provider_notification_id: nextProviderNotificationId,
          delivered_at: nextStatus === "sent" ? row.delivered_at ?? now : null,
        })
        .eq("id", row.id);
      if (updateError) {
        throw new Error(updateError.message);
      }
      updated += 1;
      notificationUpdatedCounts.set(
        row.notification_id,
        (notificationUpdatedCounts.get(row.notification_id) ?? 0) + 1,
      );
    }
  }

  const notificationIds = [...notificationStatusCounts.keys()];
  if (notificationIds.length > 0) {
    const { data: notifications, error: notificationError } = await supabase
      .from("notifications")
      .select("id,metadata")
      .in("id", notificationIds);
    if (notificationError) {
      throw new Error(notificationError.message);
    }

    for (const notification of (notifications ?? []) as NotificationMetadataRow[]) {
      const statuses =
        notificationStatusCounts.get(notification.id) ??
        { pending: 0, sent: 0, failed: 0, skipped: 0 };
      const nextMetadata = {
        ...(notification.metadata ?? {}),
        verifyStatusSync: createMetadataSummary({
          syncedAt: now,
          checked: notificationCheckedCounts.get(notification.id) ?? 0,
          updated: notificationUpdatedCounts.get(notification.id) ?? 0,
          statuses,
        }),
      };
      const { error: metadataError } = await supabase
        .from("notifications")
        .update({ metadata: nextMetadata })
        .eq("id", notification.id);
      if (metadataError) {
        throw new Error(metadataError.message);
      }
    }
  }

  return {
    configured: true,
    checked,
    updated,
    skipped: rows.length - checked,
    campaigns: groupByCampaign(rows).size,
    failedCampaigns,
  };
}
