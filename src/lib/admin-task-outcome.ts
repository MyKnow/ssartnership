import { getAdminRouteTimingLabel } from "@/lib/admin-performance";

export const ADMIN_TASK_OUTCOME_MIN_SAMPLE_COUNT = 30;

export type AdminTaskOutcomeSummaryInput = {
  taskKey?: string | null;
  startCount?: number | string | null;
  completeCount?: number | string | null;
  recoveryCount?: number | string | null;
  completionRate?: number | string | null;
  recoveryRate?: number | string | null;
  p75DurationMs?: number | string | null;
};

export type AdminTaskOutcomeSummaryMetric = {
  taskKey: string;
  label: string;
  startCount: number;
  completeCount: number;
  recoveryCount: number;
  completionRate: number | null;
  recoveryRate: number | null;
  p75DurationMs: number | null;
  status: "unknown" | "insufficient_sample" | "observed";
};

function toNonNegativeNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function toOptionalPercentage(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : null;
}

function toOptionalDuration(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(120_000, Math.max(0, parsed)) : null;
}

export function toAdminTaskOutcomeSummary(
  rows: AdminTaskOutcomeSummaryInput[] | null | undefined,
): AdminTaskOutcomeSummaryMetric[] {
  return (rows ?? [])
    .map((row) => {
      const taskKey =
        typeof row.taskKey === "string" && /^admin\.[a-z0-9._:-]+$/i.test(row.taskKey)
          ? row.taskKey
          : "admin.unknown";
      const startCount = Math.round(toNonNegativeNumber(row.startCount));

      return {
        taskKey,
        label: getAdminRouteTimingLabel(taskKey),
        startCount,
        completeCount: Math.round(toNonNegativeNumber(row.completeCount)),
        recoveryCount: Math.round(toNonNegativeNumber(row.recoveryCount)),
        completionRate: toOptionalPercentage(row.completionRate),
        recoveryRate: toOptionalPercentage(row.recoveryRate),
        p75DurationMs: toOptionalDuration(row.p75DurationMs),
        status:
          startCount === 0
            ? "unknown"
            : startCount < ADMIN_TASK_OUTCOME_MIN_SAMPLE_COUNT
              ? "insufficient_sample"
              : "observed",
      } satisfies AdminTaskOutcomeSummaryMetric;
    })
    .sort((left, right) => right.startCount - left.startCount || left.label.localeCompare(right.label, "ko-KR"));
}
