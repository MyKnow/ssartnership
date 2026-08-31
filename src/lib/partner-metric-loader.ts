import type { getSupabaseAdminClient } from "./supabase/server.ts";
import {
  buildPartnerMetricRollupRowsFromEventLogs,
  fetchPartnerMetricEventLogRows,
  fetchPartnerMetricRollupRows,
  type PartnerMetricEventLogRow,
  type PartnerMetricEventName,
  type PartnerMetricGranularity,
  type PartnerMetricKind,
  type PartnerMetricRollupRow,
} from "./partner-metric-rollups.ts";

type PartnerMetricSupabaseClient = ReturnType<typeof getSupabaseAdminClient>;

export type PartnerMetricAggregateLoadOptions = {
  partnerIds: readonly string[];
  metricNames: readonly PartnerMetricEventName[];
  metricKinds: readonly PartnerMetricKind[];
  granularity?: PartnerMetricGranularity;
};

export type PartnerMetricAggregateLoadFailure = {
  stage: "rollup" | "fallback";
  errorMessage: string;
};

export type PartnerMetricAggregateLoadResult = {
  rows: PartnerMetricRollupRow[];
  source: "rollup" | "event-log";
  failure: PartnerMetricAggregateLoadFailure | null;
};

export type PartnerMetricAggregateLoaders = {
  fetchRollupRows: typeof fetchPartnerMetricRollupRows;
  fetchEventLogRows: typeof fetchPartnerMetricEventLogRows;
};

const DEFAULT_LOADERS: PartnerMetricAggregateLoaders = {
  fetchRollupRows: fetchPartnerMetricRollupRows,
  fetchEventLogRows: fetchPartnerMetricEventLogRows,
};

function normalizePartnerIds(partnerIds: readonly string[]) {
  return [...new Set(partnerIds.map((partnerId) => partnerId.trim()).filter(Boolean))];
}

export function buildPartnerMetricRollupRowsForPartners(
  eventRows: PartnerMetricEventLogRow[],
  partnerIds: readonly string[],
) {
  const normalizedPartnerIds = normalizePartnerIds(partnerIds);
  const requestedPartnerIds = new Set(normalizedPartnerIds);
  const rowsByPartnerId = new Map<string, PartnerMetricEventLogRow[]>();

  for (const row of eventRows) {
    const partnerId = row.target_id?.trim() ?? "";
    if (!partnerId || !requestedPartnerIds.has(partnerId)) {
      continue;
    }

    const bucket = rowsByPartnerId.get(partnerId);
    if (bucket) {
      bucket.push(row);
      continue;
    }
    rowsByPartnerId.set(partnerId, [row]);
  }

  return normalizedPartnerIds.flatMap((partnerId) =>
    buildPartnerMetricRollupRowsFromEventLogs(
      rowsByPartnerId.get(partnerId) ?? [],
      partnerId,
    ),
  );
}

export async function loadPartnerMetricAggregateRows(
  supabase: PartnerMetricSupabaseClient,
  options: PartnerMetricAggregateLoadOptions,
  loaders: PartnerMetricAggregateLoaders = DEFAULT_LOADERS,
): Promise<PartnerMetricAggregateLoadResult> {
  const partnerIds = normalizePartnerIds(options.partnerIds);
  if (partnerIds.length === 0 || options.metricKinds.length === 0) {
    return {
      rows: [],
      source: "rollup",
      failure: null,
    };
  }
  const rollupResult = await loaders.fetchRollupRows(supabase, {
    partnerIds,
    metricNames: options.metricNames,
    metricKinds: options.metricKinds,
    granularity: options.granularity,
  });

  if (rollupResult.errorMessage) {
    return {
      rows: [],
      source: "rollup",
      failure: {
        stage: "rollup",
        errorMessage: rollupResult.errorMessage,
      },
    };
  }

  if (rollupResult.rows.length > 0) {
    return {
      rows: rollupResult.rows,
      source: "rollup",
      failure: null,
    };
  }

  const fallbackResult = await loaders.fetchEventLogRows(supabase, partnerIds);
  if (fallbackResult.errorMessage) {
    return {
      rows: [],
      source: "event-log",
      failure: {
        stage: "fallback",
        errorMessage: fallbackResult.errorMessage,
      },
    };
  }

  const metricNames = options.metricNames.length > 0
    ? new Set(options.metricNames)
    : null;
  const metricKinds = new Set(options.metricKinds);
  const fallbackRows = buildPartnerMetricRollupRowsForPartners(
    fallbackResult.rows,
    partnerIds,
  ).filter(
    (row) =>
      (!metricNames || metricNames.has(row.metric_name)) &&
      metricKinds.has(row.metric_kind) &&
      (!options.granularity || row.granularity === options.granularity),
  );

  return {
    rows: fallbackRows,
    source: "event-log",
    failure: null,
  };
}
