"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import Tabs from "@/components/ui/Tabs";
import type {
  PartnerMetricTimeseriesPoint,
  PartnerMetricTimeseriesSnapshot,
  PartnerMetricTimeseriesGranularity,
} from "@/lib/partner-metric-timeseries";

const TAB_OPTIONS: ReadonlyArray<{
  value: PartnerMetricTimeseriesGranularity;
  label: string;
  description: string;
}> = [
  {
    value: "hour",
    label: "시간별 평균",
    description: "0시~23시",
  },
  {
    value: "weekday",
    label: "요일별 평균",
    description: "월~일",
  },
];

const SERIES_CONFIG = [
  {
    key: "pv",
    label: "PV 평균",
    lineClassName: "text-primary",
    circleClassName: "text-primary",
    badgeClassName: "border-primary/15 bg-primary-soft text-primary",
    dotClassName: "bg-primary",
    averageKey: "pv" as const,
    totalKey: "pvTotal" as const,
  },
  {
    key: "uv",
    label: "UV 평균",
    lineClassName: "text-warning",
    circleClassName: "text-warning",
    badgeClassName: "border-warning/20 bg-warning/10 text-warning",
    dotClassName: "bg-warning",
    averageKey: "uv" as const,
    totalKey: "uvTotal" as const,
  },
  {
    key: "cta",
    label: "CTA 평균",
    lineClassName: "text-success",
    circleClassName: "text-success",
    badgeClassName: "border-success/15 bg-success/10 text-success",
    dotClassName: "bg-success",
    averageKey: "cta" as const,
    totalKey: "ctaTotal" as const,
  },
] as const;

function formatAverage(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString("ko-KR")
    : rounded.toLocaleString("ko-KR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
}

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

function getAxisLabel(value: number) {
  return formatAverage(value);
}

function getChartHeight() {
  return 320;
}

function buildLinePath(
  points: Array<{
    x: number;
    y: number;
  }>,
) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function getPointCoordinates(
  points: PartnerMetricTimeseriesPoint[],
  width: number,
  height: number,
) {
  const padding = {
    top: 24,
    right: 24,
    bottom: 48,
    left: 52,
  };
  const plotWidth = Math.max(width - padding.left - padding.right, 1);
  const plotHeight = Math.max(height - padding.top - padding.bottom, 1);
  const maxValue = Math.max(
    ...points.map((point) => Math.max(point.pv, point.uv, point.cta)),
    1,
  );
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  return {
    padding,
    plotWidth,
    plotHeight,
    maxValue,
    points: points.map((point, index) => ({
      ...point,
      x: padding.left + stepX * index,
      yPv: padding.top + plotHeight * (1 - point.pv / maxValue),
      yUv: padding.top + plotHeight * (1 - point.uv / maxValue),
      yCta: padding.top + plotHeight * (1 - point.cta / maxValue),
    })),
  };
}

function useElementWidth(ref: RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setWidth(element.clientWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return width;
}

function MetricTimeseriesChart({
  series,
}: {
  series: PartnerMetricTimeseriesSnapshot["hour"] | PartnerMetricTimeseriesSnapshot["weekday"];
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const measuredWidth = useElementWidth(wrapperRef);
  const width = Math.max(measuredWidth, 320);
  const height = getChartHeight();
  const coords = useMemo(
    () => getPointCoordinates(series.points, width, height),
    [series.points, width, height],
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activePoint = activeIndex === null ? null : coords.points[activeIndex] ?? null;
  const pvPath = useMemo(
    () =>
      buildLinePath(
        coords.points.map((point) => ({
          x: point.x,
          y: point.yPv,
        })),
      ),
    [coords.points],
  );
  const uvPath = useMemo(
    () =>
      buildLinePath(
        coords.points.map((point) => ({
          x: point.x,
          y: point.yUv,
        })),
      ),
    [coords.points],
  );
  const ctaPath = useMemo(
    () =>
      buildLinePath(
        coords.points.map((point) => ({
          x: point.x,
          y: point.yCta,
        })),
      ),
    [coords.points],
  );

  const paths = {
    pv: pvPath,
    uv: uvPath,
    cta: ctaPath,
  } as const;

  return (
    <div
      ref={wrapperRef}
      className="relative w-full overflow-hidden"
      onMouseLeave={() => setActiveIndex(null)}
    >
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`${series.granularity === "hour" ? "시간별" : "요일별"} 평균 PV, UV, CTA 차트`}
        >
          {Array.from({ length: 4 }, (_, index) => {
            const tickValue = (coords.maxValue * index) / 3;
            const y = coords.padding.top + coords.plotHeight * (1 - index / 3);
            return (
              <g key={`grid-${index}`} className="text-border/70">
                <line
                  x1={coords.padding.left}
                  x2={width - coords.padding.right}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={index === 0 ? 0.2 : 0.08}
                  strokeDasharray={index === 0 ? "0" : "3 7"}
                />
                <text
                  x={coords.padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] font-medium"
                >
                  {getAxisLabel(tickValue)}
                </text>
              </g>
            );
          })}

          {SERIES_CONFIG.map((series) => (
            <g key={series.key} className={series.lineClassName}>
              <path
                d={paths[series.key]}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}

          {coords.points.map((point, index) => {
            const previousX = index === 0 ? coords.padding.left : coords.points[index - 1]?.x ?? point.x;
            const nextX =
              index === coords.points.length - 1
                ? width - coords.padding.right
                : coords.points[index + 1]?.x ?? point.x;
            const left = index === 0 ? coords.padding.left : (previousX + point.x) / 2;
            const right =
              index === coords.points.length - 1
                ? width - coords.padding.right
                : (point.x + nextX) / 2;

            return (
              <g key={point.label}>
                <rect
                  x={left}
                  y={coords.padding.top}
                  width={Math.max(right - left, 0)}
                  height={coords.plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setActiveIndex(index)}
                />

                {SERIES_CONFIG.map((series) => {
                  const yKey =
                    series.key === "pv"
                      ? "yPv"
                      : series.key === "uv"
                        ? "yUv"
                        : "yCta";
                  const y = point[yKey];

                  return (
                    <circle
                      key={series.key}
                      cx={point.x}
                      cy={y}
                      r={activeIndex === index ? 5 : 3.5}
                      fill="currentColor"
                      className={series.circleClassName}
                      onMouseEnter={() => setActiveIndex(index)}
                    />
                  );
                })}
                {series.granularity === "weekday" ||
                width >= 960 ||
                (width >= 720 && index % 2 === 0) ||
                (width >= 520 && index % 3 === 0) ||
                index % 4 === 0 ? (
                  <text
                    x={point.x}
                    y={height - 18}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[10px] font-medium"
                  >
                    {point.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {activePoint ? (
          <div
            className="pointer-events-none absolute z-10"
            style={{
              left: `${Math.min(
                Math.max(activePoint.x + 12, 8),
                width - 190,
              )}px`,
              top: `${Math.min(
                Math.max(Math.min(activePoint.yPv, activePoint.yUv, activePoint.yCta) - 18, 8),
                180,
              )}px`,
            }}
          >
            <div className="min-w-40 rounded-2xl border border-border bg-surface-elevated px-3 py-2 shadow-[var(--shadow-raised)]">
              <p className="text-xs font-semibold text-foreground">{activePoint.label}</p>
              <div className="mt-2 space-y-1 text-xs">
                <p className="flex items-center justify-between gap-4">
                  <span className="font-medium text-primary">PV 평균</span>
                  <span className="font-semibold text-foreground">
                    {formatAverage(activePoint.pv)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-4">
                  <span className="font-medium text-warning">UV 평균</span>
                  <span className="font-semibold text-foreground">
                    {formatAverage(activePoint.uv)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-4">
                  <span className="font-medium text-success">CTA 평균</span>
                  <span className="font-semibold text-foreground">
                    {formatAverage(activePoint.cta)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-4 text-muted-foreground">
                  <span>표본</span>
                  <span>{formatCount(activePoint.denominator)}</span>
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PartnerMetricTimeseriesPanel({
  data,
  warningMessage,
}: {
  data: PartnerMetricTimeseriesSnapshot;
  warningMessage?: string | null;
}) {
  const [tab, setTab] = useState<PartnerMetricTimeseriesGranularity>("hour");
  const currentSeries = tab === "hour" ? data.hour : data.weekday;
  const resolvedWarningMessage = warningMessage ?? data.warningMessage;

  return (
    <Card tone="default" padding="md" className="min-w-0 space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="ui-kicker">Trend</p>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
              평균 PV / UV 추이
            </h2>
            <p className="text-sm text-muted-foreground">
              {data.periodLabel} 기준으로, 0이었던 구간까지 포함해 평균을 계산합니다.
            </p>
          </div>
          <Badge className="bg-surface-muted text-muted-foreground">
            0 구간 포함
          </Badge>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={TAB_OPTIONS}
      />

      {resolvedWarningMessage ? (
        <FormMessage variant="info">{resolvedWarningMessage}</FormMessage>
      ) : null}

      {currentSeries.hasData ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {SERIES_CONFIG.map((series) => (
              <span
                key={series.key}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${series.badgeClassName}`}
              >
                <span className={`size-2 rounded-full ${series.dotClassName}`} />
                {series.key.toUpperCase()}
              </span>
            ))}
          </div>
          <MetricTimeseriesChart series={currentSeries} />
        </div>
      ) : (
        <EmptyState
          title="아직 집계된 데이터가 없습니다."
          description="상세 조회가 쌓이면 시간별과 요일별 평균이 표시됩니다."
        />
      )}
    </Card>
  );
}
