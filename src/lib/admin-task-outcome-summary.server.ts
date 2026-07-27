import {
  toAdminTaskOutcomeSummary,
  type AdminTaskOutcomeSummaryInput,
} from "@/lib/admin-task-outcome";
import { logAdminDataUnavailable } from "@/lib/admin-observability";
import {
  ADMIN_AUXILIARY_READ_MODEL_TIMEOUT_MS,
  withAdminReadModelTimeout,
} from "@/lib/admin-read-model-timeout";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const ADMIN_TASK_OUTCOME_WINDOW_DAYS = 7;

type AdminTaskOutcomeSummaryRpcRow = {
  task_key?: string | null;
  start_count?: number | string | null;
  complete_count?: number | string | null;
  recovery_count?: number | string | null;
  completion_rate?: number | string | null;
  recovery_rate?: number | string | null;
  p75_duration_ms?: number | string | null;
};

function toSummaryInput(
  row: AdminTaskOutcomeSummaryRpcRow,
): AdminTaskOutcomeSummaryInput {
  return {
    taskKey: row.task_key,
    startCount: row.start_count,
    completeCount: row.complete_count,
    recoveryCount: row.recovery_count,
    completionRate: row.completion_rate,
    recoveryRate: row.recovery_rate,
    p75DurationMs: row.p75_duration_ms,
  };
}

const EMPTY_TASK_OUTCOME_SUMMARY = {
  metrics: [],
  windowDays: ADMIN_TASK_OUTCOME_WINDOW_DAYS,
  loadError: true,
};

/**
 * Returns only bounded task outcome aggregates. Raw event properties and
 * dynamic record identifiers never cross the server/UI boundary.
 */
async function loadAdminTaskOutcomeSummary() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - ADMIN_TASK_OUTCOME_WINDOW_DAYS);

  try {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "get_admin_task_outcome_summary",
      {
        input_start: start.toISOString(),
        input_end: end.toISOString(),
      },
    );

    if (error) {
      logAdminDataUnavailable("admin-task-outcome", error);
      return EMPTY_TASK_OUTCOME_SUMMARY;
    }

    return {
      metrics: toAdminTaskOutcomeSummary(
        (data ?? []).map((row: unknown) =>
          toSummaryInput(row as AdminTaskOutcomeSummaryRpcRow),
        ),
      ),
      windowDays: ADMIN_TASK_OUTCOME_WINDOW_DAYS,
      loadError: false,
    };
  } catch (error) {
    logAdminDataUnavailable("admin-task-outcome", error);
    return EMPTY_TASK_OUTCOME_SUMMARY;
  }
}

export function getAdminTaskOutcomeSummary() {
  return withAdminReadModelTimeout(
    loadAdminTaskOutcomeSummary(),
    EMPTY_TASK_OUTCOME_SUMMARY,
    ADMIN_AUXILIARY_READ_MODEL_TIMEOUT_MS,
  );
}
