import {
  toAdminWebVitalSummary,
  type AdminWebVitalSummaryInput,
} from "@/lib/admin-performance";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const ADMIN_WEB_VITAL_WINDOW_DAYS = 7;

type AdminWebVitalSummaryRpcRow = {
  metric?: string | null;
  sample_count?: number | string | null;
  p75_value?: number | string | null;
  good_count?: number | string | null;
  needs_improvement_count?: number | string | null;
  poor_count?: number | string | null;
};

function toSummaryInput(row: AdminWebVitalSummaryRpcRow): AdminWebVitalSummaryInput {
  return {
    metric: row.metric,
    sampleCount: row.sample_count,
    p75Value: row.p75_value,
    goodCount: row.good_count,
    needsImprovementCount: row.needs_improvement_count,
    poorCount: row.poor_count,
  };
}

/**
 * Uses a database percentile aggregate so the logs page never downloads raw
 * RUM events or exposes event properties to the browser.
 */
export async function getAdminWebVitalSummary() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - ADMIN_WEB_VITAL_WINDOW_DAYS);

  try {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "get_admin_web_vitals_summary",
      {
        input_start: start.toISOString(),
        input_end: end.toISOString(),
      },
    );
    if (error) {
      console.error("[admin-web-vitals] summary query failed", error.message);
      return {
        metrics: toAdminWebVitalSummary(),
        windowDays: ADMIN_WEB_VITAL_WINDOW_DAYS,
        loadError: true,
      };
    }

    return {
      metrics: toAdminWebVitalSummary(
        (data ?? []).map((row) => toSummaryInput(row as AdminWebVitalSummaryRpcRow)),
      ),
      windowDays: ADMIN_WEB_VITAL_WINDOW_DAYS,
      loadError: false,
    };
  } catch {
    console.error("[admin-web-vitals] summary query failed", {
      reasonCode: "unexpected_failure",
    });
    return {
      metrics: toAdminWebVitalSummary(),
      windowDays: ADMIN_WEB_VITAL_WINDOW_DAYS,
      loadError: true,
    };
  }
}
