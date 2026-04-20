import { formatKoreanDateTimeToMinute } from "./datetime.ts";
import {
  buildPartnerMetricRollupRowsFromEventLogs,
  fetchPartnerMetricEventLogRows,
  type PartnerMetricRollupRow,
  fetchPartnerMetricRollupRows,
  PARTNER_METRIC_EVENT_NAMES,
} from "./partner-metric-rollups.ts";
import { getSupabaseAdminClient } from "./supabase/server.ts";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const HOUR_LABELS = Array.from({ length: 24 }, (_, index) => `${index}시`);
const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export type PartnerMetricTimeseriesGranularity = "hour" | "weekday";

export type PartnerMetricTimeseriesPoint = {
  label: string;
  denominator: number;
  pvTotal: number;
  uvTotal: number;
  ctaTotal: number;
  pv: number;
  uv: number;
  cta: number;
};

export type PartnerMetricTimeseriesSeries = {
  granularity: PartnerMetricTimeseriesGranularity;
  labels: string[];
  points: PartnerMetricTimeseriesPoint[];
  maxAverage: number;
  hasData: boolean;
};

export type PartnerMetricTimeseriesSnapshot = {
  periodLabel: string;
  hour: PartnerMetricTimeseriesSeries;
  weekday: PartnerMetricTimeseriesSeries;
  warningMessage: string | null;
};

function toKstMillis(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getTime() + KST_OFFSET_MS;
}

function startOfLocalDay(localMillis: number) {
  return Math.floor(localMillis / DAY_MS) * DAY_MS;
}

function averageCount(total: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return total / denominator;
}

function buildHourDenominators(startLocalMillis: number, endLocalMillis: number) {
  const denominators = Array.from({ length: 24 }, () => 0);
  const startDay = startOfLocalDay(startLocalMillis);
  const endDay = startOfLocalDay(endLocalMillis);

  for (let dayMillis = startDay; dayMillis <= endDay; dayMillis += DAY_MS) {
    for (let hour = 0; hour < 24; hour += 1) {
      const bucketStart = dayMillis + hour * HOUR_MS;
      const bucketEnd = bucketStart + HOUR_MS;

      if (bucketStart < endLocalMillis && bucketEnd > startLocalMillis) {
        denominators[hour] += 1;
      }
    }
  }

  return denominators;
}

function buildWeekdayDenominators(startLocalMillis: number, endLocalMillis: number) {
  const denominators = Array.from({ length: 7 }, () => 0);
  const startDay = startOfLocalDay(startLocalMillis);
  const endDay = startOfLocalDay(endLocalMillis);

  for (let dayMillis = startDay; dayMillis <= endDay; dayMillis += DAY_MS) {
    const dayEnd = dayMillis + DAY_MS;
    if (dayMillis >= endLocalMillis || dayEnd <= startLocalMillis) {
      continue;
    }

    const weekday = new Date(dayMillis).getUTCDay() || 7;
    denominators[weekday - 1] += 1;
  }

  return denominators;
}

function parseLocalHour(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d{2}):\d{2}:\d{2}(?:\.\d+)?$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function createSeriesPoints(labels: string[], denominators: number[]) {
  return labels.map((label, index) => ({
    label,
    denominator: denominators[index] ?? 0,
    pvTotal: 0,
    uvTotal: 0,
    ctaTotal: 0,
    pv: 0,
    uv: 0,
    cta: 0,
  }));
}

function finalizeSeries(
  granularity: PartnerMetricTimeseriesGranularity,
  labels: string[],
  denominators: number[],
  rows: PartnerMetricRollupRow[],
): PartnerMetricTimeseriesSeries {
  const points = createSeriesPoints(labels, denominators);

  for (const row of rows) {
    if (row.granularity !== granularity) {
      continue;
    }

    const pointIndex =
      granularity === "hour"
        ? parseLocalHour(row.bucket_local_start)
        : typeof row.bucket_local_dow === "number"
          ? row.bucket_local_dow - 1
          : null;

    if (pointIndex === null || pointIndex < 0 || pointIndex >= points.length) {
      continue;
    }

    const point = points[pointIndex];
    if (row.metric_name === "partner_detail_view") {
      if (row.metric_kind === "uv") {
        point.uvTotal += row.metric_count;
      } else {
        point.pvTotal += row.metric_count;
      }
      continue;
    }

    if (row.metric_kind === "pv") {
      point.ctaTotal += row.metric_count;
    }
  }

  for (const point of points) {
    point.pv = averageCount(point.pvTotal, point.denominator);
    point.uv = averageCount(point.uvTotal, point.denominator);
    point.cta = averageCount(point.ctaTotal, point.denominator);
  }

  const maxAverage = points.reduce(
    (max, point) => Math.max(max, point.pv, point.uv, point.cta),
    0,
  );

  return {
    granularity,
    labels,
    points,
    maxAverage,
    hasData: points.some(
      (point) => point.pvTotal > 0 || point.uvTotal > 0 || point.ctaTotal > 0,
    ),
  };
}

export function buildPartnerMetricTimeseriesSnapshot(
  partnerCreatedAt: string,
  rows: PartnerMetricRollupRow[],
  now = new Date(),
): PartnerMetricTimeseriesSnapshot {
  const startLocalMillis = toKstMillis(partnerCreatedAt);
  const endLocalMillis = toKstMillis(now);

  if (startLocalMillis === null || endLocalMillis === null) {
    return {
      periodLabel: "",
      hour: finalizeSeries("hour", HOUR_LABELS, Array.from({ length: 24 }, () => 0), []),
      weekday: finalizeSeries(
        "weekday",
        [...WEEKDAY_LABELS],
        Array.from({ length: 7 }, () => 0),
        [],
      ),
      warningMessage: null,
    };
  }

  const periodLabel = `${formatKoreanDateTimeToMinute(partnerCreatedAt)} ~ 현재`;
  const hourDenominators = buildHourDenominators(startLocalMillis, endLocalMillis);
  const weekdayDenominators = buildWeekdayDenominators(startLocalMillis, endLocalMillis);

  return {
    periodLabel,
    hour: finalizeSeries("hour", HOUR_LABELS, hourDenominators, rows),
    weekday: finalizeSeries("weekday", [...WEEKDAY_LABELS], weekdayDenominators, rows),
    warningMessage: null,
  };
}

export async function getPartnerMetricTimeseriesSnapshot(
  partnerId: string,
  partnerCreatedAt: string,
): Promise<PartnerMetricTimeseriesSnapshot> {
  const supabase = getSupabaseAdminClient();
  const result = await fetchPartnerMetricRollupRows(supabase, {
    partnerIds: [partnerId],
    metricNames: PARTNER_METRIC_EVENT_NAMES,
    metricKinds: ["pv", "uv"],
  });

  let rows = result.rows;
  if (!result.errorMessage && result.rows.length === 0) {
    const fallbackResult = await fetchPartnerMetricEventLogRows(supabase, [partnerId]);
    if (!fallbackResult.errorMessage) {
      rows = buildPartnerMetricRollupRowsFromEventLogs(fallbackResult.rows, partnerId);
    }
  }

  const snapshot = buildPartnerMetricTimeseriesSnapshot(
    partnerCreatedAt,
    rows,
    new Date(),
  );

  return {
    ...snapshot,
    warningMessage: result.errorMessage
      ? "일부 시계열 통계를 불러오지 못해 최신 수치가 0으로 표시될 수 있습니다."
      : null,
  };
}
