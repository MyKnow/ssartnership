import {
  toAdminPrefetchSummary,
  type AdminPrefetchSummaryInput,
} from "@/lib/admin-performance";
import { logAdminDataUnavailable } from "@/lib/admin-observability";
import {
  ADMIN_AUXILIARY_READ_MODEL_TIMEOUT_MS,
  withAdminReadModelTimeout,
} from "@/lib/admin-read-model-timeout";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const ADMIN_PREFETCH_WINDOW_DAYS = 7;

type AdminPrefetchSummaryRpcRow = {
  route_key?: string | null;
  requested_count?: number | string | null;
  used_count?: number | string | null;
  utilization_rate?: number | string | null;
};

function toSummaryInput(row: AdminPrefetchSummaryRpcRow): AdminPrefetchSummaryInput {
  return {
    routeKey: row.route_key,
    requestedCount: row.requested_count,
    usedCount: row.used_count,
    utilizationRate: row.utilization_rate,
  };
}

const EMPTY_PREFETCH_SUMMARY = {
  metrics: [],
  windowDays: ADMIN_PREFETCH_WINDOW_DAYS,
  loadError: true,
};

async function loadAdminPrefetchSummary() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - ADMIN_PREFETCH_WINDOW_DAYS);

  try {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "get_admin_prefetch_summary",
      {
        input_start: start.toISOString(),
        input_end: end.toISOString(),
      },
    );
    if (error) {
      logAdminDataUnavailable("admin-prefetch", error);
      return EMPTY_PREFETCH_SUMMARY;
    }

    return {
      metrics: toAdminPrefetchSummary(
        (data ?? []).map((row: unknown) =>
          toSummaryInput(row as AdminPrefetchSummaryRpcRow),
        ),
      ),
      windowDays: ADMIN_PREFETCH_WINDOW_DAYS,
      loadError: false,
    };
  } catch (error) {
    logAdminDataUnavailable("admin-prefetch", error);
    return EMPTY_PREFETCH_SUMMARY;
  }
}

export function getAdminPrefetchSummary() {
  return withAdminReadModelTimeout(
    loadAdminPrefetchSummary(),
    EMPTY_PREFETCH_SUMMARY,
    ADMIN_AUXILIARY_READ_MODEL_TIMEOUT_MS,
  );
}
