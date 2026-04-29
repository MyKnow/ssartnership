"use client";

import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import Tabs from "@/components/ui/Tabs";

type MemberTrendGranularity = "daily" | "weekly" | "monthly" | "yearly";

type MemberTrendBucket = {
  key: string;
  label: string;
  rangeLabel: string;
  count: number;
  cumulative: number;
};

const GRANULARITY_OPTIONS: ReadonlyArray<{
  value: MemberTrendGranularity;
  label: string;
  description: string;
}> = [
  { value: "daily", label: "일별", description: "최근 7일" },
  { value: "weekly", label: "주별", description: "최근 1개월" },
  { value: "monthly", label: "월별", description: "최근 1년" },
  { value: "yearly", label: "연별", description: "전체" },
];

function formatRangeLabel(date: Date) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function getStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getStartOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const next = new Date(date);
  next.setDate(date.getDate() + diff);
  return getStartOfDay(next);
}

function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getStartOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addYears(date: Date, amount: number) {
  return new Date(date.getFullYear() + amount, 0, 1);
}

function buildBuckets(createdAts: string[], granularity: MemberTrendGranularity) {
  const parsedDates = createdAts
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (parsedDates.length === 0) {
    return [] as MemberTrendBucket[];
  }

  const latestDate = parsedDates[parsedDates.length - 1]!;
  const today = getStartOfDay(latestDate);
  const counts = new Map<string, number>();
  const buckets: Array<{
    key: string;
    label: string;
    rangeLabel: string;
  }> = [];

  if (granularity === "daily") {
    const start = addDays(today, -6);
    for (let index = 0; index < 7; index += 1) {
      const bucketStart = addDays(start, index);
      const key = bucketStart.toISOString();
      buckets.push({
        key,
        label: `${bucketStart.getMonth() + 1}/${bucketStart.getDate()}`,
        rangeLabel: formatRangeLabel(bucketStart),
      });
    }

    for (const date of parsedDates) {
      const normalized = getStartOfDay(date);
      if (normalized < start || normalized > today) {
        continue;
      }
      const key = normalized.toISOString();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  } else if (granularity === "weekly") {
    const latestWeek = getStartOfWeek(today);
    const start = addDays(latestWeek, -21);
    for (let index = 0; index < 4; index += 1) {
      const bucketStart = addDays(start, index * 7);
      const bucketEnd = addDays(bucketStart, 6);
      const key = bucketStart.toISOString();
      buckets.push({
        key,
        label: `${bucketStart.getMonth() + 1}/${bucketStart.getDate()}`,
        rangeLabel: `${formatRangeLabel(bucketStart)} ~ ${formatRangeLabel(bucketEnd)}`,
      });
    }

    for (const date of parsedDates) {
      const normalized = getStartOfWeek(date);
      if (normalized < start || normalized > latestWeek) {
        continue;
      }
      const key = normalized.toISOString();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  } else if (granularity === "monthly") {
    const latestMonth = getStartOfMonth(today);
    const start = addMonths(latestMonth, -11);
    for (let index = 0; index < 12; index += 1) {
      const bucketStart = addMonths(start, index);
      const key = bucketStart.toISOString();
      buckets.push({
        key,
        label: `${String(bucketStart.getFullYear()).slice(2)}.${String(bucketStart.getMonth() + 1).padStart(2, "0")}`,
        rangeLabel: `${bucketStart.getFullYear()}년 ${bucketStart.getMonth() + 1}월`,
      });
    }

    for (const date of parsedDates) {
      const normalized = getStartOfMonth(date);
      if (normalized < start || normalized > latestMonth) {
        continue;
      }
      const key = normalized.toISOString();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  } else {
    const firstYear = getStartOfYear(parsedDates[0]!);
    const latestYear = getStartOfYear(today);

    for (
      let cursor = new Date(firstYear);
      cursor <= latestYear;
      cursor = addYears(cursor, 1)
    ) {
      const key = cursor.toISOString();
      buckets.push({
        key,
        label: `${cursor.getFullYear()}`,
        rangeLabel: `${cursor.getFullYear()}년`,
      });
    }

    for (const date of parsedDates) {
      const normalized = getStartOfYear(date);
      const key = normalized.toISOString();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  let cumulative = 0;
  return buckets.map((bucket) => {
    const count = counts.get(bucket.key) ?? 0;
    cumulative += count;
    return {
      ...bucket,
      count,
      cumulative,
    };
  });
}

function buildPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export default function AdminMemberTrendChart({
  createdAts,
}: {
  createdAts: string[];
}) {
  const [granularity, setGranularity] = useState<MemberTrendGranularity>("daily");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const buckets = useMemo(() => buildBuckets(createdAts, granularity), [createdAts, granularity]);
  const width = Math.max(buckets.length * 72, 480);
  const height = 128;
  const padding = { top: 10, right: 12, bottom: 28, left: 32 };
  const plotWidth = Math.max(width - padding.left - padding.right, 1);
  const plotHeight = Math.max(height - padding.top - padding.bottom, 1);
  const maxValue = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const stepX = buckets.length > 1 ? plotWidth / (buckets.length - 1) : 0;
  const points = buckets.map((bucket, index) => ({
    ...bucket,
    x: padding.left + stepX * index,
    y: padding.top + plotHeight * (1 - bucket.count / maxValue),
  }));
  const activePoint = activeIndex === null ? points[points.length - 1] ?? null : points[activeIndex] ?? null;

  return (
    <Card tone="elevated" className="min-w-0 overflow-hidden">
      <div className="grid gap-4">
        <SectionHeading
          title="회원 유입 추이"
          description="현재 필터 기준 회원 생성 이력을 일·주·월·연 단위로 확인합니다."
        />
        <Tabs
          value={granularity}
          onChange={(value) => {
            setGranularity(value);
            setActiveIndex(null);
          }}
          options={GRANULARITY_OPTIONS}
          className="xl:grid-cols-4"
        />
      </div>

      {activePoint ? (
        <div className="mt-4 grid gap-2 rounded-2xl border border-border bg-surface-inset px-4 py-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              구간
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{activePoint.rangeLabel}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              변화량
            </p>
            <p className="mt-1 text-sm font-semibold text-primary">
              +{activePoint.count.toLocaleString()}명
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              누적
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {activePoint.cumulative.toLocaleString()}명
            </p>
          </div>
        </div>
      ) : null}

      <div
        className="-mx-1 mt-3 overflow-x-auto pb-1"
        onMouseLeave={() => setActiveIndex(null)}
      >
        <div className="min-w-max px-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="block h-auto min-w-full"
            role="img"
            aria-label="회원 유입 추이 차트"
          >
            {Array.from({ length: 4 }, (_, index) => {
              const y = padding.top + plotHeight * (index / 3);
              const value = Math.round(maxValue * (1 - index / 3));
              return (
                <g key={`grid-${index}`} className="text-border/70">
                  <line
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={index === 3 ? 0.2 : 0.08}
                    strokeDasharray={index === 3 ? "0" : "3 7"}
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-muted-foreground text-[8px] font-medium"
                  >
                    {value}
                  </text>
                </g>
              );
            })}

            <path d={buildPath(points)} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary" />

            {points.map((point, index) => {
              const active = activePoint?.key === point.key;
              return (
                <g key={point.key}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={active ? 5 : 3.5}
                    className={active ? "fill-primary" : "fill-primary/75"}
                  />
                  <text
                    x={point.x}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[8px] font-medium"
                  >
                    {point.label}
                  </text>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="14"
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => setActiveIndex(index)}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </Card>
  );
}
