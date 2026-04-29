"use client";

import { useMemo, useState } from "react";
import AdminTimeseriesChart from "@/components/admin/AdminTimeseriesChart";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import Tabs from "@/components/ui/Tabs";
import { cn } from "@/lib/cn";

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

export default function AdminMemberTrendChart({
  createdAts,
}: {
  createdAts: string[];
}) {
  const [granularity, setGranularity] = useState<MemberTrendGranularity>("daily");
  const buckets = useMemo(() => buildBuckets(createdAts, granularity), [createdAts, granularity]);

  return (
    <div className="grid gap-4 xl:grid-cols-[14rem_minmax(0,1fr)]">
      <Card tone="elevated" className="hidden min-w-0 overflow-hidden xl:block xl:self-start">
        <SectionHeading
          title="시계열 해상도"
          description="원하는 범위 단위로 유입 변화를 확인합니다."
        />
        <div className="mt-4 grid gap-2">
          {GRANULARITY_OPTIONS.map((option) => {
            const active = option.value === granularity;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setGranularity(option.value)}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-raised"
                    : "border-border bg-surface-inset text-foreground hover:border-strong",
                )}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span
                  className={cn(
                    "mt-1 block text-xs",
                    active ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card tone="elevated" className="min-w-0 overflow-hidden">
        <div className="grid gap-4">
          <SectionHeading
            title="회원 유입 추이"
            description="현재 필터 기준 회원 생성 이력을 일·주·월·연 단위로 확인합니다."
          />
          <div className="xl:hidden">
            <Tabs
              value={granularity}
              onChange={(value) => {
                setGranularity(value);
              }}
              options={GRANULARITY_OPTIONS}
              className="xl:grid-cols-4"
            />
          </div>
        </div>
        <AdminTimeseriesChart
          points={buckets.map((bucket) => ({
            key: bucket.key,
            label: bucket.label,
            rangeLabel: bucket.rangeLabel,
            values: {
              members: bucket.count,
              cumulative: bucket.cumulative,
            },
          }))}
          series={[
            {
              key: "members",
              label: "회원 유입",
              lineClassName: "text-primary",
              dotClassName: "fill-primary",
            },
          ]}
          ariaLabel="회원 유입 추이 차트"
          renderSummary={(point) => ({
            rangeLabel: point.rangeLabel,
            items: [
              {
                label: "변화량",
                value: `+${(point.values.members ?? 0).toLocaleString()}명`,
                valueClassName: "text-primary",
              },
              {
                label: "누적",
                value: `${(point.values.cumulative ?? 0).toLocaleString()}명`,
              },
            ],
          })}
        />
      </Card>
    </div>
  );
}
