import {
  toAdminRouteTimingSummary,
  type AdminRouteTimingSummaryInput,
} from "@/lib/admin-performance";
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

/**
 * Aggregates safe route timing fields on the server. Raw paths, identifiers,
 * query strings, and event properties never cross the server/UI boundary.
 */
export async function getAdminRouteTimingSummary() {
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
      console.error("[admin-route-timing] summary query failed", error.message);
      return {
        metrics: [],
        windowDays: ADMIN_ROUTE_TIMING_WINDOW_DAYS,
        loadError: true,
      };
    }

    return {
      metrics: toAdminRouteTimingSummary(
        (data ?? []).map((row) =>
          toSummaryInput(row as AdminRouteTimingSummaryRpcRow),
        ),
      ),
      windowDays: ADMIN_ROUTE_TIMING_WINDOW_DAYS,
      loadError: false,
    };
  } catch {
    console.error("[admin-route-timing] summary query failed", {
      reasonCode: "unexpected_failure",
    });
    return {
      metrics: [],
      windowDays: ADMIN_ROUTE_TIMING_WINDOW_DAYS,
      loadError: true,
    };
  }
}
