import type { PartnerPortalServiceMetrics } from "./partner-dashboard.ts";
import { getSupabaseAdminClient } from "./supabase/server.ts";

export const PARTNER_METRIC_EVENT_NAMES = [
  "partner_detail_view",
  "partner_card_click",
  "partner_map_click",
  "reservation_click",
  "inquiry_click",
] as const;

export type PartnerMetricEventName =
  (typeof PARTNER_METRIC_EVENT_NAMES)[number];

export type PartnerMetricGranularity = "total" | "hour" | "day" | "weekday";

export type PartnerMetricRollupRow = {
  partner_id: string;
  metric_name: PartnerMetricEventName;
  granularity: PartnerMetricGranularity;
  bucket_timezone: string;
  bucket_local_start: string | null;
  bucket_local_date: string | null;
  bucket_local_dow: number | null;
  metric_count: number;
};

const PARTNER_METRIC_ROLLUP_SELECT =
  "partner_id,metric_name,granularity,bucket_timezone,bucket_local_start,bucket_local_date,bucket_local_dow,metric_count";

function isPartnerMetricEventName(value: string): value is PartnerMetricEventName {
  return (PARTNER_METRIC_EVENT_NAMES as readonly string[]).includes(value);
}

function isPartnerMetricGranularity(value: string): value is PartnerMetricGranularity {
  return value === "total" || value === "hour" || value === "day" || value === "weekday";
}

function parseMetricCount(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRollupRow(row: Record<string, unknown>): PartnerMetricRollupRow | null {
  if (typeof row.partner_id !== "string") {
    return null;
  }
  if (typeof row.metric_name !== "string" || !isPartnerMetricEventName(row.metric_name)) {
    return null;
  }
  if (typeof row.granularity !== "string" || !isPartnerMetricGranularity(row.granularity)) {
    return null;
  }
  if (typeof row.bucket_timezone !== "string") {
    return null;
  }

  const metricCount = parseMetricCount(row.metric_count);
  const bucketLocalStart =
    typeof row.bucket_local_start === "string" ? row.bucket_local_start : null;
  const bucketLocalDate =
    typeof row.bucket_local_date === "string" ? row.bucket_local_date : null;
  const bucketLocalDow =
    typeof row.bucket_local_dow === "number" ? row.bucket_local_dow : null;

  return {
    partner_id: row.partner_id,
    metric_name: row.metric_name,
    granularity: row.granularity,
    bucket_timezone: row.bucket_timezone,
    bucket_local_start: bucketLocalStart,
    bucket_local_date: bucketLocalDate,
    bucket_local_dow: bucketLocalDow,
    metric_count: metricCount,
  };
}

export function applyPartnerMetricCount(
  metrics: PartnerPortalServiceMetrics,
  metricName: PartnerMetricEventName,
  count: number,
) {
  switch (metricName) {
    case "partner_detail_view":
      metrics.detailViews += count;
      break;
    case "partner_card_click":
      metrics.cardClicks += count;
      break;
    case "partner_map_click":
      metrics.mapClicks += count;
      break;
    case "reservation_click":
      metrics.reservationClicks += count;
      break;
    case "inquiry_click":
      metrics.inquiryClicks += count;
      break;
  }

  metrics.totalClicks =
    metrics.cardClicks +
    metrics.mapClicks +
    metrics.reservationClicks +
    metrics.inquiryClicks;
}

export function applyPartnerMetricRollupRows(
  metricsByPartnerId: Map<string, PartnerPortalServiceMetrics>,
  rows: PartnerMetricRollupRow[],
) {
  for (const row of rows) {
    const metrics = metricsByPartnerId.get(row.partner_id);
    if (!metrics) {
      continue;
    }

    applyPartnerMetricCount(metrics, row.metric_name, row.metric_count);
  }
}

function normalizePartnerIds(partnerIds: readonly string[]) {
  return [...new Set(partnerIds.map((partnerId) => partnerId.trim()).filter(Boolean))];
}

export async function fetchPartnerMetricRollupRows(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  filters: {
    partnerIds?: readonly string[];
    metricNames?: readonly PartnerMetricEventName[];
    granularity?: PartnerMetricGranularity;
    bucketTimezone?: string;
    bucketLocalStart?: string;
    bucketLocalDate?: string;
    bucketLocalDow?: number;
  } = {},
): Promise<{ rows: PartnerMetricRollupRow[]; errorMessage: string | null }> {
  const normalizedPartnerIds = filters.partnerIds
    ? normalizePartnerIds(filters.partnerIds)
    : [];

  if (filters.partnerIds && normalizedPartnerIds.length === 0) {
    return {
      rows: [],
      errorMessage: null,
    };
  }

  let query = supabase.from("partner_metric_rollups").select(PARTNER_METRIC_ROLLUP_SELECT);

  if (normalizedPartnerIds.length > 0) {
    query = query.in("partner_id", normalizedPartnerIds);
  }
  if (filters.metricNames && filters.metricNames.length > 0) {
    query = query.in("metric_name", filters.metricNames);
  }
  if (filters.granularity) {
    query = query.eq("granularity", filters.granularity);
  }
  if (filters.bucketTimezone) {
    query = query.eq("bucket_timezone", filters.bucketTimezone);
  }
  if (filters.bucketLocalStart) {
    query = query.eq("bucket_local_start", filters.bucketLocalStart);
  }
  if (filters.bucketLocalDate) {
    query = query.eq("bucket_local_date", filters.bucketLocalDate);
  }
  if (typeof filters.bucketLocalDow === "number") {
    query = query.eq("bucket_local_dow", filters.bucketLocalDow);
  }

  const { data, error } = await query;
  if (error) {
    return {
      rows: [],
      errorMessage: error.message,
    };
  }

  const rows = (data ?? [])
    .map((row) => normalizeRollupRow(row as Record<string, unknown>))
    .filter((row): row is PartnerMetricRollupRow => row !== null);

  return {
    rows,
    errorMessage: null,
  };
}
