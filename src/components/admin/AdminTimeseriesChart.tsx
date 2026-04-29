"use client";

import { useMemo, useState } from "react";

export type AdminTimeseriesSeries = {
  key: string;
  label: string;
  lineClassName: string;
  dotClassName: string;
  strokeWidth?: number;
};

export type AdminTimeseriesPoint = {
  key: string;
  label: string;
  rangeLabel: string;
  values: Record<string, number>;
};

export type AdminTimeseriesSummary = {
  rangeLabel: string;
  items: Array<{
    label: string;
    value: string;
    valueClassName?: string;
  }>;
};

type ComputedChartPoint = AdminTimeseriesPoint & {
  x: number;
} & Record<`${string}Y`, number>;

function buildPath(points: ComputedChartPoint[], key: `${string}Y`) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point[key]}`).join(" ");
}

export default function AdminTimeseriesChart({
  points,
  series,
  ariaLabel,
  height = 128,
  minWidth = 480,
  widthPerPoint = 72,
  renderSummary,
}: {
  points: AdminTimeseriesPoint[];
  series: AdminTimeseriesSeries[];
  ariaLabel: string;
  height?: number;
  minWidth?: number;
  widthPerPoint?: number;
  renderSummary: (point: AdminTimeseriesPoint) => AdminTimeseriesSummary;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const width = Math.max(points.length * widthPerPoint, minWidth);
  const padding = { top: 10, right: 12, bottom: 28, left: 32 };
  const plotWidth = Math.max(width - padding.left - padding.right, 1);
  const plotHeight = Math.max(height - padding.top - padding.bottom, 1);
  const maxValue = Math.max(
    ...points.flatMap((point) => series.map((entry) => point.values[entry.key] ?? 0)),
    1,
  );
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const chartPoints = useMemo(
    () =>
      points.map<ComputedChartPoint>((point, index) => {
        const next: ComputedChartPoint = {
          ...point,
          x: padding.left + stepX * index,
        };

        for (const entry of series) {
          next[`${entry.key}Y`] = padding.top + plotHeight * (1 - (point.values[entry.key] ?? 0) / maxValue);
        }

        return next;
      }),
    [maxValue, padding.left, padding.top, plotHeight, points, series, stepX],
  );

  const activePoint =
    chartPoints[hoveredIndex ?? selectedIndex ?? chartPoints.length - 1] ?? null;
  const activeSummary = activePoint ? renderSummary(activePoint) : null;
  const interactionWidth = points.length > 1 ? Math.max(stepX, 44) : 72;

  return (
    <>
      {activeSummary ? (
        <div className="mt-4 grid gap-2 rounded-2xl border border-border bg-surface-inset px-4 py-4 sm:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              구간
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{activeSummary.rangeLabel}</p>
          </div>
          {activeSummary.items.map((item) => (
            <div key={`${activeSummary.rangeLabel}-${item.label}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {item.label}
              </p>
              <p className={`mt-1 text-sm font-semibold ${item.valueClassName ?? "text-foreground"}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div
        className="-mx-1 mt-3 overflow-x-auto pb-1"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <div className="min-w-max px-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="block h-auto min-w-full"
            role="img"
            aria-label={ariaLabel}
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

            {series.map((entry) => (
              <path
                key={`line-${entry.key}`}
                d={buildPath(chartPoints, `${entry.key}Y`)}
                fill="none"
                stroke="currentColor"
                strokeWidth={entry.strokeWidth ?? 2.5}
                className={entry.lineClassName}
              />
            ))}

            {chartPoints.map((point, index) => {
              const active = activePoint?.key === point.key;
              return (
                <g key={point.key}>
                  {series.map((entry) => (
                    <circle
                      key={`${point.key}-${entry.key}`}
                      cx={point.x}
                      cy={point[`${entry.key}Y`]}
                      r={active ? 5 : 3.5}
                      className={entry.dotClassName}
                    />
                  ))}
                  <text
                    x={point.x}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[8px] font-medium"
                  >
                    {point.label}
                  </text>
                  <rect
                    x={point.x - interactionWidth / 2}
                    y={padding.top}
                    width={interactionWidth}
                    height={plotHeight + 6}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onClick={() => setSelectedIndex(index)}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </>
  );
}
