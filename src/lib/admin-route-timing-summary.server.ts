import {
  toAdminRouteTimingSummary,
  type AdminRouteTimingSummaryInput,
} from "@/lib/admin-performance";
import { logAdminDataUnavailable } from "@/lib/admin-observability";
import {
  ADMIN_AUXILIARY_READ_MODEL_TIMEOUT_MS,
  withAdminReadModelTimeout,
} from "@/lib/admin-read-model-timeout";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const ADMIN_ROUTE_TIMING_WINDOW_DAYS = 7;

type AdminRouteTimingSummaryRpcRow = {
  route_key?: string | null;
  sample_count?: number | string | null;
  p75_duration_ms?: number | string | null;
  complete_count?: number | string | null;
  unknown_count?: number | string | null;
  error_count?: number | string | null;
};

function toSummaryInput(
  row: AdminRouteTimingSummaryRpcRow,
): AdminRouteTimingSummaryInput {
  return {
    routeKey: row.route_key,
    sampleCount: row.sample_count,
    p75DurationMs: row.p75_duration_ms,
    completeCount: row.complete_count,
    unknownCount: row.unknown_count,
    errorCount: row.error_count,
  };
}

const EMPTY_ROUTE_TIMING_SUMMARY = {
  metrics: [],
  windowDays: ADMIN_ROUTE_TIMING_WINDOW_DAYS,
  loadError: true,
};

/**
 * Aggregates safe route timing fields on the server. Raw paths, identifiers,
 * query strings, and event properties never cross the server/UI boundary.
 */
async function loadAdminRouteTimingSummary() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - ADMIN_ROUTE_TIMING_WINDOW_DAYS);

  try {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "get_admin_route_timing_summary",
      {
        input_start: start.toISOString(),
        input_end: end.toISOString(),
      },
    );

    if (error) {
      logAdminDataUnavailable("admin-route-timing", error);
      return EMPTY_ROUTE_TIMING_SUMMARY;
    }

    return {
      metrics: toAdminRouteTimingSummary(
        (data ?? []).map((row: unknown) =>
          toSummaryInput(row as AdminRouteTimingSummaryRpcRow),
        ),
      ),
      windowDays: ADMIN_ROUTE_TIMING_WINDOW_DAYS,
      loadError: false,
    };
  } catch (error) {
    logAdminDataUnavailable("admin-route-timing", error);
    return EMPTY_ROUTE_TIMING_SUMMARY;
  }
}

export function getAdminRouteTimingSummary() {
  return withAdminReadModelTimeout(
    loadAdminRouteTimingSummary(),
    EMPTY_ROUTE_TIMING_SUMMARY,
    ADMIN_AUXILIARY_READ_MODEL_TIMEOUT_MS,
  );
}
