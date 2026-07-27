export const ADMIN_PERFORMANCE_MIN_SAMPLE_COUNT = 30;

export const ADMIN_WEB_VITAL_TARGETS = {
  INP: 200,
  LCP: 2_500,
  TTFB: 800,
};

const ADMIN_VIEWPORTS = new Set(["mobile", "tablet", "desktop"]);

function normalizeViewport(value) {
  return typeof value === "string" && ADMIN_VIEWPORTS.has(value)
    ? value
    : "unknown";
}

export function toFiniteNonNegativeNumber(value) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

export function percentile(values, ratio) {
  const sorted = values
    .map(toFiniteNonNegativeNumber)
    .filter((value) => value !== null)
    .sort((left, right) => left - right);

  if (sorted.length === 0) {
    return null;
  }

  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function getPerformanceStatus(sampleCount, p75Value, threshold) {
  if (sampleCount === 0 || p75Value === null) {
    return "unknown";
  }
  if (sampleCount < ADMIN_PERFORMANCE_MIN_SAMPLE_COUNT) {
    return "insufficient_sample";
  }
  return p75Value <= threshold ? "met" : "exceeded";
}

export function summarizeWebVitals(rows = []) {
  return Object.entries(ADMIN_WEB_VITAL_TARGETS).map(([metric, threshold]) => {
    const row = rows.find((candidate) => candidate?.metric === metric);
    const sampleCount = Math.max(0, Math.round(Number(row?.sample_count ?? 0)));
    const p75Value = toFiniteNonNegativeNumber(row?.p75_value);

    return {
      metric,
      sampleCount,
      p75Value,
      threshold,
      status: getPerformanceStatus(sampleCount, p75Value, threshold),
    };
  });
}

export function summarizeViewportWebVitals(rows = []) {
  return rows.map((row) => {
    const sampleCount = Math.max(0, Math.round(Number(row?.sample_count ?? 0)));
    const p75Value = toFiniteNonNegativeNumber(row?.p75_value);
    const metric = typeof row?.metric === "string" ? row.metric : "unknown";
    const threshold = ADMIN_WEB_VITAL_TARGETS[metric] ?? null;

    return {
      viewport: normalizeViewport(row?.viewport),
      metric,
      sampleCount,
      p75Value,
      threshold,
      status: threshold === null
        ? "unknown"
        : getPerformanceStatus(sampleCount, p75Value, threshold),
    };
  });
}

export function summarizeRouteTiming(rows = []) {
  return rows.map((row) => {
    const sampleCount = Math.max(0, Math.round(Number(row?.sample_count ?? 0)));
    const p75Value = toFiniteNonNegativeNumber(row?.p75_duration_ms);

    return {
      routeKey: typeof row?.route_key === "string" ? row.route_key : "admin.unknown",
      sampleCount,
      p75DurationMs: p75Value,
      completeCount: Math.max(0, Math.round(Number(row?.complete_count ?? 0))),
      unknownCount: Math.max(0, Math.round(Number(row?.unknown_count ?? 0))),
      errorCount: Math.max(0, Math.round(Number(row?.error_count ?? 0))),
      status: getPerformanceStatus(sampleCount, p75Value, 200),
    };
  });
}

export function summarizeViewportRouteTiming(rows = []) {
  return rows.map((row) => ({
    viewport: normalizeViewport(row?.viewport),
    ...summarizeRouteTiming([row])[0],
  }));
}

export function summarizeTaskOutcome(rows = []) {
  return rows.map((row) => {
    const startCount = Math.max(0, Math.round(Number(row?.start_count ?? 0)));
    const p75Value = toFiniteNonNegativeNumber(row?.p75_duration_ms);

    return {
      taskKey: typeof row?.task_key === "string" ? row.task_key : "admin.unknown",
      startCount,
      completeCount: Math.max(0, Math.round(Number(row?.complete_count ?? 0))),
      recoveryCount: Math.max(0, Math.round(Number(row?.recovery_count ?? 0))),
      completionRate: toFiniteNonNegativeNumber(row?.completion_rate),
      recoveryRate: toFiniteNonNegativeNumber(row?.recovery_rate),
      p75DurationMs: p75Value,
      status: getPerformanceStatus(startCount, p75Value, 200),
    };
  });
}

export function summarizeViewportTaskOutcome(rows = []) {
  return rows.map((row) => ({
    viewport: normalizeViewport(row?.viewport),
    ...summarizeTaskOutcome([row])[0],
  }));
}

export function summarizeHttpSamples(samples) {
  const successful = samples.filter((sample) => sample.status >= 200 && sample.status < 400);
  const phaseNames = ["auth", "session", "query", "storage", "total"].filter(
    (phase) => samples.some((sample) => sample.serverTiming?.[phase] !== undefined),
  );

  return {
    requestCount: samples.length,
    successCount: successful.length,
    errorCount: samples.length - successful.length,
    totalP95Ms: percentile(samples.map((sample) => sample.totalMs), 0.95),
    serverTimingP95Ms: Object.fromEntries(
      phaseNames.map((phase) => [
        phase,
        percentile(
          samples
            .map((sample) => sample.serverTiming?.[phase])
            .filter((value) => value !== undefined),
          0.95,
        ),
      ]),
    ),
  };
}
