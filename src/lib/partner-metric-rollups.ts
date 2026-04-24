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

export const PARTNER_METRIC_KINDS = ["pv", "uv"] as const;

export type PartnerMetricKind = (typeof PARTNER_METRIC_KINDS)[number];

export type PartnerMetricGranularity = "total" | "hour" | "day" | "weekday";

export type PartnerMetricRollupRow = {
  partner_id: string;
  metric_name: PartnerMetricEventName;
  metric_kind: PartnerMetricKind;
  granularity: PartnerMetricGranularity;
  bucket_timezone: string;
  bucket_local_start: string | null;
  bucket_local_date: string | null;
  bucket_local_dow: number | null;
  metric_count: number;
};

export type PartnerMetricEventLogRow = {
  target_id: string | null;
  event_name: PartnerMetricEventName;
  actor_type: string;
  actor_id: string | null;
  session_id: string | null;
  created_at: string | null;
};

const PARTNER_METRIC_ROLLUP_SELECT =
  "partner_id,metric_name,metric_kind,granularity,bucket_timezone,bucket_local_start,bucket_local_date,bucket_local_dow,metric_count";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KST_TIMEZONE = "Asia/Seoul";

function isPartnerMetricEventName(value: string): value is PartnerMetricEventName {
  return (PARTNER_METRIC_EVENT_NAMES as readonly string[]).includes(value);
}

function isPartnerMetricKind(value: string): value is PartnerMetricKind {
  return value === "pv" || value === "uv";
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
  if (typeof row.metric_kind !== "string" || !isPartnerMetricKind(row.metric_kind)) {
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
    metric_kind: row.metric_kind,
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
  metricKind: PartnerMetricKind,
  count: number,
) {
  if (metricKind === "uv") {
    if (metricName === "partner_detail_view") {
      metrics.detailUv += count;
    }
    return;
  }

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

    applyPartnerMetricCount(metrics, row.metric_name, row.metric_kind, row.metric_count);
  }
}

function normalizePartnerIds(partnerIds: readonly string[]) {
  return [...new Set(partnerIds.map((partnerId) => partnerId.trim()).filter(Boolean))];
}

function toKstBucketParts(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  const hour = String(kst.getUTCHours()).padStart(2, "0");
  const bucketLocalDate = `${year}-${month}-${day}`;
  const bucketLocalStart = `${bucketLocalDate} ${hour}:00:00`;
  const bucketLocalDow = (kst.getUTCDay() || 7) as 1 | 2 | 3 | 4 | 5 | 6 | 7;

  return {
    bucket_timezone: KST_TIMEZONE,
    bucket_local_start: bucketLocalStart,
    bucket_local_date: bucketLocalDate,
    bucket_local_dow: bucketLocalDow,
  };
}

function getPartnerMetricVisitorKey(
  actorType: string,
  actorId: string | null,
  sessionId: string | null,
) {
  return (
    sessionId?.trim() ||
    (actorId ? `${actorType}:${actorId}` : "")
  );
}

type PartnerMetricRollupDraftRow = {
  partner_id: string;
  metric_name: PartnerMetricEventName;
  metric_kind: PartnerMetricKind;
  granularity: PartnerMetricGranularity;
  bucket_timezone: string;
  bucket_local_start: string | null;
  bucket_local_date: string | null;
  bucket_local_dow: number | null;
  metric_count: number;
};

export type PartnerMetricEventInput = {
  partnerId: string;
  eventName: PartnerMetricEventName;
  actorType: string;
  actorId?: string | null;
  sessionId?: string | null;
  createdAt?: string | Date | null;
};

function createDraftKey(row: PartnerMetricRollupDraftRow) {
  return [
    row.partner_id,
    row.metric_name,
    row.metric_kind,
    row.granularity,
    row.bucket_timezone,
    row.bucket_local_start ?? "",
    row.bucket_local_date ?? "",
    row.bucket_local_dow ?? "",
  ].join("|");
}

export function buildPartnerMetricRollupRowsFromEventLogs(
  eventRows: PartnerMetricEventLogRow[],
  partnerId: string,
) {
  const counters = new Map<string, PartnerMetricRollupDraftRow>();
  const uvSeenByBucket = {
    total: new Set<string>(),
    hour: new Map<string, Set<string>>(),
    day: new Map<string, Set<string>>(),
    weekday: new Map<string, Set<string>>(),
  };

  const bump = (row: Omit<PartnerMetricRollupDraftRow, "metric_count">, count = 1) => {
    const key = createDraftKey({ ...row, metric_count: 0 });
    const current = counters.get(key);
    if (current) {
      current.metric_count += count;
      return;
    }
    counters.set(key, { ...row, metric_count: count });
  };

  for (const event of eventRows) {
    const bucketParts = toKstBucketParts(event.created_at ?? new Date());
    if (!bucketParts) {
      continue;
    }

    const pvTargets: Array<Pick<PartnerMetricRollupDraftRow, "granularity" | "bucket_local_start" | "bucket_local_date" | "bucket_local_dow">> = [
      {
        granularity: "total",
        bucket_local_start: null,
        bucket_local_date: null,
        bucket_local_dow: null,
      },
      {
        granularity: "hour",
        bucket_local_start: bucketParts.bucket_local_start,
        bucket_local_date: null,
        bucket_local_dow: null,
      },
      {
        granularity: "day",
        bucket_local_start: null,
        bucket_local_date: bucketParts.bucket_local_date,
        bucket_local_dow: null,
      },
      {
        granularity: "weekday",
        bucket_local_start: null,
        bucket_local_date: null,
        bucket_local_dow: bucketParts.bucket_local_dow,
      },
    ];

    for (const target of pvTargets) {
      bump({
      partner_id: partnerId,
      metric_name: event.event_name,
      metric_kind: "pv",
      granularity: target.granularity,
        bucket_timezone: KST_TIMEZONE,
        bucket_local_start: target.bucket_local_start,
        bucket_local_date: target.bucket_local_date,
        bucket_local_dow: target.bucket_local_dow,
      });
    }

    if (event.event_name !== "partner_detail_view") {
      continue;
    }

    const visitorKey = getPartnerMetricVisitorKey(
      event.actor_type,
      event.actor_id,
      event.session_id,
    );
    if (!visitorKey) {
      continue;
    }

    const bucketKeys = {
      total: "total",
      hour: `hour:${bucketParts.bucket_local_start}`,
      day: `day:${bucketParts.bucket_local_date}`,
      weekday: `weekday:${bucketParts.bucket_local_dow}`,
    } as const;

    if (!uvSeenByBucket.total.has(visitorKey)) {
      uvSeenByBucket.total.add(visitorKey);
      bump({
      partner_id: partnerId,
      metric_name: event.event_name,
      metric_kind: "uv",
      granularity: "total",
        bucket_timezone: KST_TIMEZONE,
        bucket_local_start: null,
        bucket_local_date: null,
        bucket_local_dow: null,
      });
    }

    for (const granularity of ["hour", "day", "weekday"] as const) {
      const bucketKey = bucketKeys[granularity];
      const seenByBucket = uvSeenByBucket[granularity];
      const bucketSeen = seenByBucket.get(bucketKey) ?? new Set<string>();
      if (bucketSeen.has(visitorKey)) {
        continue;
      }
      bucketSeen.add(visitorKey);
      seenByBucket.set(bucketKey, bucketSeen);

      bump({
        partner_id: partnerId,
        metric_name: event.event_name,
        metric_kind: "uv",
        granularity,
        bucket_timezone: KST_TIMEZONE,
        bucket_local_start:
          granularity === "hour" ? bucketParts.bucket_local_start : null,
        bucket_local_date:
          granularity === "day" ? bucketParts.bucket_local_date : null,
        bucket_local_dow:
          granularity === "weekday" ? bucketParts.bucket_local_dow : null,
      });
    }
  }

  return Array.from(counters.values());
}

export async function fetchPartnerMetricEventLogRows(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  partnerIds: readonly string[],
) {
  const normalizedPartnerIds = normalizePartnerIds(partnerIds);
  if (normalizedPartnerIds.length === 0) {
    return { rows: [] as PartnerMetricEventLogRow[], errorMessage: null as string | null };
  }

  const { data, error } = await supabase
    .from("event_logs")
    .select("target_id,event_name,actor_type,actor_id,session_id,created_at")
    .eq("target_type", "partner")
    .in("target_id", normalizedPartnerIds)
    .in("event_name", [...PARTNER_METRIC_EVENT_NAMES]);

  if (error) {
    return { rows: [], errorMessage: error.message };
  }

  const rows = (data ?? []).filter(
    (row): row is PartnerMetricEventLogRow =>
      typeof row.target_id === "string" &&
      isPartnerMetricEventName(String(row.event_name)) &&
      typeof row.event_name === "string" &&
      typeof row.actor_type === "string" &&
      (typeof row.actor_id === "string" || row.actor_id === null) &&
      (typeof row.session_id === "string" || row.session_id === null) &&
      (typeof row.created_at === "string" || row.created_at === null),
  );

  return { rows, errorMessage: null as string | null };
}

async function runPartnerMetricRpc(
  fn: "apply_partner_metric_event" | "reconcile_partner_metric_rollups",
  args: Record<string, unknown>,
) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) {
    throw new Error(error.message);
  }
}

export async function reconcilePartnerMetricRollupsFromEventLogs(
  partnerId: string,
) {
  await runPartnerMetricRpc("reconcile_partner_metric_rollups", {
    input_partner_id: partnerId,
  });
}

export async function upsertPartnerMetricRollupsFromEventInput(
  input: PartnerMetricEventInput,
) {
  await runPartnerMetricRpc("apply_partner_metric_event", {
    input_partner_id: input.partnerId,
    input_event_name: input.eventName,
    input_actor_type: input.actorType,
    input_actor_id: input.actorId ?? null,
    input_session_id: input.sessionId ?? null,
    input_created_at:
      input.createdAt instanceof Date
        ? input.createdAt.toISOString()
        : input.createdAt ?? new Date().toISOString(),
  });
}

export async function fetchPartnerMetricRollupRows(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  filters: {
    partnerIds?: readonly string[];
    metricNames?: readonly PartnerMetricEventName[];
    metricKinds?: readonly PartnerMetricKind[];
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
  const metricKinds = [...(filters.metricKinds ?? ["pv"])];

  if (filters.partnerIds && normalizedPartnerIds.length === 0) {
    return {
      rows: [],
      errorMessage: null,
    };
  }

  if (metricKinds.length === 0) {
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
    query = query.in("metric_name", [...filters.metricNames]);
  }
  if (metricKinds.length > 0) {
    query = query.in("metric_kind", metricKinds);
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
