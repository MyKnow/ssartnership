import type {
  GetAdminLogsPageDataOptions,
  LogChartBucket,
  LogRangePreset,
  ResolvedLogRange,
  TimedLogRow,
} from './shared';
import { DEFAULT_PRESET, MAX_CUSTOM_RANGE_MS, RANGE_PRESET_MS } from './shared';
import {
  formatKoreanDate,
  formatKoreanDateTime,
} from "@/lib/datetime";

function isRangePreset(value: string | null | undefined): value is LogRangePreset {
  return (
    value === '1h' ||
    value === '12h' ||
    value === '24h' ||
    value === '7d' ||
    value === '30d' ||
    value === 'custom'
  );
}

function parseDateInput(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatRangeDateTime(date: Date) {
  return formatKoreanDateTime(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRangePresetLabel(preset: LogRangePreset) {
  switch (preset) {
    case '1h':
      return '최근 1시간';
    case '12h':
      return '최근 12시간';
    case '24h':
      return '최근 24시간';
    case '7d':
      return '최근 7일';
    case '30d':
      return '최근 30일';
    case 'custom':
      return '사용자 지정';
    default:
      return '조회 범위';
  }
}

export function getBucketSizeMs(durationMs: number) {
  if (durationMs <= 60 * 60 * 1000) {
    return { sizeMs: 5 * 60 * 1000, label: '5분 단위' };
  }
  if (durationMs <= 12 * 60 * 60 * 1000) {
    return { sizeMs: 60 * 60 * 1000, label: '1시간 단위' };
  }
  if (durationMs <= 24 * 60 * 60 * 1000) {
    return { sizeMs: 2 * 60 * 60 * 1000, label: '2시간 단위' };
  }
  if (durationMs <= 7 * 24 * 60 * 60 * 1000) {
    return { sizeMs: 24 * 60 * 60 * 1000, label: '1일 단위' };
  }
  if (durationMs <= 31 * 24 * 60 * 60 * 1000) {
    return { sizeMs: 5 * 24 * 60 * 60 * 1000, label: '5일 단위' };
  }
  if (durationMs <= 90 * 24 * 60 * 60 * 1000) {
    return { sizeMs: 7 * 24 * 60 * 60 * 1000, label: '1주 단위' };
  }
  return { sizeMs: 30 * 24 * 60 * 60 * 1000, label: '1개월 단위' };
}

function formatBucketLabel(start: Date, bucketSizeMs: number) {
  if (bucketSizeMs <= 2 * 60 * 60 * 1000) {
    return formatKoreanDateTime(start, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return formatKoreanDate(start);
}

function formatBucketRangeLabel(start: Date, end: Date) {
  return `${formatRangeDateTime(start)} ~ ${formatRangeDateTime(end)}`;
}

export function resolveLogRange(
  options: GetAdminLogsPageDataOptions = {},
): ResolvedLogRange {
  const now = new Date();
  const requestedPreset = isRangePreset(options.preset)
    ? options.preset
    : DEFAULT_PRESET;

  if (requestedPreset !== 'custom') {
    const durationMs = RANGE_PRESET_MS[requestedPreset];
    const start = new Date(now.getTime() - durationMs);
    const bucket = getBucketSizeMs(durationMs);
    return {
      preset: requestedPreset,
      start: start.toISOString(),
      end: now.toISOString(),
      label: getRangePresetLabel(requestedPreset),
      bucketLabel: bucket.label,
      durationMs,
    };
  }

  const parsedStart = parseDateInput(options.start);
  const parsedEnd = parseDateInput(options.end);
  if (!parsedStart || !parsedEnd) {
    return resolveLogRange({ preset: DEFAULT_PRESET });
  }

  let start = parsedStart;
  let end = parsedEnd;
  if (start.getTime() > end.getTime()) {
    [start, end] = [end, start];
  }
  if (start.getTime() === end.getTime()) {
    end = new Date(end.getTime() + 60 * 1000);
  }
  if (end.getTime() - start.getTime() > MAX_CUSTOM_RANGE_MS) {
    start = new Date(end.getTime() - MAX_CUSTOM_RANGE_MS);
  }

  const durationMs = end.getTime() - start.getTime();
  const bucket = getBucketSizeMs(durationMs);
  return {
    preset: 'custom',
    start: start.toISOString(),
    end: end.toISOString(),
    label: `${formatRangeDateTime(start)} ~ ${formatRangeDateTime(end)}`,
    bucketLabel: bucket.label,
    durationMs,
  };
}

export function buildChartBuckets(
  range: ResolvedLogRange,
  productLogs: TimedLogRow[],
  auditLogs: TimedLogRow[],
  securityLogs: TimedLogRow[],
) {
  const startTime = new Date(range.start).getTime();
  const endTime = new Date(range.end).getTime();
  const { sizeMs } = getBucketSizeMs(range.durationMs);
  const buckets: LogChartBucket[] = [];

  for (let cursor = startTime; cursor < endTime; cursor += sizeMs) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(Math.min(cursor + sizeMs, endTime));
    buckets.push({
      key: bucketStart.toISOString(),
      label: formatBucketLabel(bucketStart, sizeMs),
      rangeLabel: formatBucketRangeLabel(bucketStart, bucketEnd),
      start: bucketStart.toISOString(),
      end: bucketEnd.toISOString(),
      product: 0,
      audit: 0,
      security: 0,
      total: 0,
    });
  }

  const increment = (value: string, group: 'product' | 'audit' | 'security') => {
    const timestamp = new Date(value).getTime();
    const rawIndex = Math.floor((timestamp - startTime) / sizeMs);
    const bucketIndex = Math.max(0, Math.min(buckets.length - 1, rawIndex));
    const bucket = buckets[bucketIndex];
    if (!bucket) {
      return;
    }
    bucket[group] += 1;
    bucket.total += 1;
  };

  productLogs.forEach((log) => increment(log.created_at, 'product'));
  auditLogs.forEach((log) => increment(log.created_at, 'audit'));
  securityLogs.forEach((log) => increment(log.created_at, 'security'));

  return buckets;
}
