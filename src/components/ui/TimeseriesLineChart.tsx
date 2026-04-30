"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

export type TimeseriesChartSeries = {
  key: string;
  label: string;
  lineClassName: string;
  circleClassName: string;
  strokeWidth?: number;
};

export type TimeseriesChartPoint = {
  key: string;
  label: string;
  rangeLabel?: string;
  values: Record<string, string | number>;
};

export type TimeseriesChartTooltip = {
  title: string;
  items: Array<{
    label: string;
    value: string;
    valueClassName?: string;
  }>;
};

type PositionedPoint = TimeseriesChartPoint & {
  x: number;
  yBySeries: Record<string, number>;
};

const DEFAULT_PADDING = {
  top: 24,
  right: 24,
  bottom: 48,
  left: 52,
};

function formatAxisValue(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString("ko-KR")
    : rounded.toLocaleString("ko-KR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
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

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return width;
}

function getNumericValue(point: TimeseriesChartPoint, key: string) {
  const value = Number(point.values[key]);
  return Number.isFinite(value) ? value : 0;
}

function getPointCoordinates({
  points,
  series,
  width,
  height,
}: {
  points: TimeseriesChartPoint[];
  series: TimeseriesChartSeries[];
  width: number;
  height: number;
}) {
  const padding = DEFAULT_PADDING;
  const plotWidth = Math.max(width - padding.left - padding.right, 1);
  const plotHeight = Math.max(height - padding.top - padding.bottom, 1);
  const values = points.flatMap((point) => series.map((entry) => getNumericValue(point, entry.key)));
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const span = Math.max(maxValue - minValue, 1);
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  return {
    padding,
    plotWidth,
    plotHeight,
    minValue,
    maxValue,
    points: points.map((point, index): PositionedPoint => {
      const yBySeries = Object.fromEntries(
        series.map((entry) => {
          const value = getNumericValue(point, entry.key);
          return [
            entry.key,
            padding.top + plotHeight * (1 - (value - minValue) / span),
          ];
        }),
      );

      return {
        ...point,
        x: padding.left + stepX * index,
        yBySeries,
      };
    }),
  };
}

export default function TimeseriesLineChart({
  points,
  series,
  ariaLabel,
  height = 320,
  minWidth = 320,
  renderTooltip,
}: {
  points: TimeseriesChartPoint[];
  series: TimeseriesChartSeries[];
  ariaLabel: string;
  height?: number;
  minWidth?: number;
  renderTooltip: (point: TimeseriesChartPoint) => TimeseriesChartTooltip;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const measuredWidth = useElementWidth(wrapperRef);
  const width = Math.max(measuredWidth, minWidth);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activePoint =
    activeIndex === null ? null : points[activeIndex] ?? null;
  const coords = useMemo(
    () => getPointCoordinates({ points, series, width, height }),
    [height, points, series, width],
  );
  const paths = useMemo(
    () =>
      Object.fromEntries(
        series.map((entry) => [
          entry.key,
          buildLinePath(
            coords.points.map((point) => ({
              x: point.x,
              y: point.yBySeries[entry.key] ?? coords.padding.top + coords.plotHeight,
            })),
          ),
        ]),
      ),
    [coords.padding.top, coords.plotHeight, coords.points, series],
  );
  const activePosition =
    activeIndex === null ? null : coords.points[activeIndex] ?? null;
  const activeTooltip = activePoint ? renderTooltip(activePoint) : null;

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
          aria-label={ariaLabel}
        >
          {Array.from({ length: 4 }, (_, index) => {
            const tickValue =
              coords.minValue + ((coords.maxValue - coords.minValue) * index) / 3;
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
                  {formatAxisValue(tickValue)}
                </text>
              </g>
            );
          })}

          {series.map((entry) => (
            <g key={entry.key} className={entry.lineClassName}>
              <path
                d={paths[entry.key]}
                fill="none"
                stroke="currentColor"
                strokeWidth={entry.strokeWidth ?? 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}

          {coords.points.map((point, index) => {
            const previousX =
              index === 0 ? coords.padding.left : coords.points[index - 1]?.x ?? point.x;
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
              <g key={point.key}>
                <rect
                  x={left}
                  y={coords.padding.top}
                  width={Math.max(right - left, 0)}
                  height={coords.plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setActiveIndex(index)}
                />

                {series.map((entry) => {
                  const y = point.yBySeries[entry.key] ?? coords.padding.top;
                  return (
                    <circle
                      key={entry.key}
                      cx={point.x}
                      cy={y}
                      r={activeIndex === index ? 5 : 3.5}
                      fill="currentColor"
                      className={entry.circleClassName}
                      onMouseEnter={() => setActiveIndex(index)}
                    />
                  );
                })}

                {points.length <= 8 ||
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

        {activePosition && activeTooltip ? (
          <div
            className="pointer-events-none absolute z-10"
            style={{
              left: `${Math.min(Math.max(activePosition.x + 12, 8), width - 224)}px`,
              top: `${Math.min(
                Math.max(
                  Math.min(...Object.values(activePosition.yBySeries)) - 18,
                  8,
                ),
                Math.max(height - 140, 8),
              )}px`,
            }}
          >
            <div className="min-w-40 rounded-2xl border border-border bg-surface-elevated px-3 py-2 shadow-raised">
              <p className="text-xs font-semibold text-foreground">
                {activeTooltip.title}
              </p>
              <div className="mt-2 space-y-1 text-xs">
                {activeTooltip.items.map((item) => (
                  <p
                    key={`${activeTooltip.title}-${item.label}`}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className={item.valueClassName ?? "font-medium text-muted-foreground"}>
                      {item.label}
                    </span>
                    <span className="font-semibold text-foreground">{item.value}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
