const ADMIN_WEB_VITAL_NAMES = ["CLS", "FCP", "INP", "LCP", "TTFB"] as const;
const ADMIN_WEB_VITAL_TARGET_METRICS = ["INP", "LCP", "TTFB"] as const;

/**
 * A release-confidence floor, not a replacement for a larger RUM cohort.
 * Smaller samples stay visible but never appear as a confirmed target pass.
 */
export const ADMIN_WEB_VITAL_MIN_SAMPLE_COUNT = 30;

export const ADMIN_WEB_VITAL_TARGETS = {
  INP: { threshold: 200, unit: "ms", label: "상호작용 응답" },
  LCP: { threshold: 2_500, unit: "ms", label: "첫 유용 콘텐츠" },
  TTFB: { threshold: 800, unit: "ms", label: "서버 응답" },
} as const;

export type AdminWebVitalName = (typeof ADMIN_WEB_VITAL_NAMES)[number];
export type AdminWebVitalTargetMetric = (typeof ADMIN_WEB_VITAL_TARGET_METRICS)[number];
export type AdminWebVitalRating = "good" | "needs-improvement" | "poor";
export type AdminWebVitalSummaryInput = {
  metric?: string | null;
  sampleCount?: number | string | null;
  p75Value?: number | string | null;
  goodCount?: number | string | null;
  needsImprovementCount?: number | string | null;
  poorCount?: number | string | null;
};
export type AdminWebVitalSummaryMetric = {
  metric: AdminWebVitalTargetMetric;
  label: string;
  threshold: number;
  sampleCount: number;
  p75Value: number | null;
  goodCount: number;
  needsImprovementCount: number;
  poorCount: number;
  status: "unknown" | "insufficient_sample" | "met" | "exceeded";
};

type AdminWebVitalInput = {
  name: string;
  rating: string;
  value: number;
};

export function isAdminWebVitalName(value: string): value is AdminWebVitalName {
  return (ADMIN_WEB_VITAL_NAMES as readonly string[]).includes(value);
}

export function isAdminWebVitalTargetMetric(
  value: string,
): value is AdminWebVitalTargetMetric {
  return (ADMIN_WEB_VITAL_TARGET_METRICS as readonly string[]).includes(value);
}

function toNonNegativeNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function toOptionalNonNegativeNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

/**
 * Normalizes the database aggregate into the three release targets. Missing
 * metrics remain unknown instead of being presented as passing performance.
 */
export function toAdminWebVitalSummary(
  rows: AdminWebVitalSummaryInput[] | null | undefined,
): AdminWebVitalSummaryMetric[] {
  const rowsByMetric = new Map(
    (rows ?? [])
      .filter((row) => isAdminWebVitalTargetMetric(row.metric ?? ""))
      .map((row) => [row.metric as AdminWebVitalTargetMetric, row]),
  );

  return ADMIN_WEB_VITAL_TARGET_METRICS.map((metric) => {
    const row = rowsByMetric.get(metric);
    const sampleCount = Math.round(toNonNegativeNumber(row?.sampleCount));
    const p75Value = toOptionalNonNegativeNumber(row?.p75Value);
    const threshold = ADMIN_WEB_VITAL_TARGETS[metric].threshold;

    return {
      metric,
      label: ADMIN_WEB_VITAL_TARGETS[metric].label,
      threshold,
      sampleCount,
      p75Value,
      goodCount: Math.round(toNonNegativeNumber(row?.goodCount)),
      needsImprovementCount: Math.round(toNonNegativeNumber(row?.needsImprovementCount)),
      poorCount: Math.round(toNonNegativeNumber(row?.poorCount)),
      status:
        sampleCount === 0 || p75Value === null
          ? "unknown"
          : sampleCount < ADMIN_WEB_VITAL_MIN_SAMPLE_COUNT
            ? "insufficient_sample"
            : p75Value <= threshold
              ? "met"
              : "exceeded",
    };
  });
}

function normalizeRating(value: string): AdminWebVitalRating {
  if (value === "good" || value === "poor") {
    return value;
  }
  return "needs-improvement";
}

export function toAdminWebVitalProperties({
  name,
  rating,
  value,
}: AdminWebVitalInput) {
  return {
    metric: isAdminWebVitalName(name) ? name : "TTFB",
    rating: normalizeRating(rating),
    value: Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0,
  };
}
