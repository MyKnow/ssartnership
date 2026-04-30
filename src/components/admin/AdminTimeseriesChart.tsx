"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  values: Record<string, string | number>;
};

export type AdminTimeseriesSummary = {
  rangeLabel: string;
  items: Array<{
    label: string;
    value: string;
    valueClassName?: string;
  }>;
};

type ChartRow = {
  key: string;
  label: string;
  rangeLabel: string;
} & Record<string, string | number>;

type ChartInteractionState = {
  activeTooltipIndex?: number;
  activeLabel?: string | number;
  activePayload?: Array<{
    payload?: {
      key?: string;
    };
  }>;
  activeCoordinate?: {
    x?: number;
    y?: number;
  };
};

const CHART_MARGIN = {
  top: 12,
  right: 20,
  bottom: 12,
  left: 20,
};

const BUBBLE_WIDTH = 224;
const BUBBLE_EDGE_PADDING = 12;
const BUBBLE_HORIZONTAL_SHIFT = 48;
const BUBBLE_PIVOT_RATIO = 0.46;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const COLOR_BY_LINE_CLASS: Record<string, string> = {
  "text-primary": "var(--color-primary)",
  "text-foreground/35": "color-mix(in srgb, var(--color-foreground) 35%, transparent)",
  "text-sky-500": "#0ea5e9",
  "text-violet-500": "#8b5cf6",
  "text-amber-500": "#f59e0b",
};

const COLOR_BY_DOT_CLASS: Record<string, string> = {
  "fill-primary": "var(--color-primary)",
  "fill-foreground/25": "color-mix(in srgb, var(--color-foreground) 25%, transparent)",
  "fill-sky-500": "#0ea5e9",
  "fill-violet-500": "#8b5cf6",
  "fill-amber-500": "#f59e0b",
};

function resolveLineColor(className: string) {
  return COLOR_BY_LINE_CLASS[className] ?? "var(--color-primary)";
}

function resolveDotColor(className: string) {
  return COLOR_BY_DOT_CLASS[className] ?? "var(--color-primary)";
}

function HiddenTooltip() {
  return null;
}

function resolveInteractionKey(state: ChartInteractionState, chartData: ChartRow[]) {
  const payloadKey = state.activePayload?.[0]?.payload?.key;
  if (typeof payloadKey === "string") {
    return payloadKey;
  }

  if (typeof state.activeTooltipIndex === "number") {
    const indexedRow = chartData[state.activeTooltipIndex];
    if (typeof indexedRow?.key === "string") {
      return indexedRow.key;
    }
  }

  if (typeof state.activeLabel === "string" || typeof state.activeLabel === "number") {
    const nextLabel = String(state.activeLabel);
    const labelRow = chartData.find((row) => row.label === nextLabel);
    if (labelRow) {
      return labelRow.key;
    }
  }

  return null;
}

export default function AdminTimeseriesChart({
  points,
  series,
  ariaLabel,
  minWidth = 480,
  widthPerPoint = 72,
  renderSummary,
}: {
  points: AdminTimeseriesPoint[];
  series: AdminTimeseriesSeries[];
  ariaLabel: string;
  minWidth?: number;
  widthPerPoint?: number;
  renderSummary: (point: AdminTimeseriesPoint) => AdminTimeseriesSummary;
}) {
  const chartSurfaceRef = useRef<HTMLDivElement | null>(null);
  const [hoveredInteraction, setHoveredInteraction] = useState<{
    key: string;
    coordinate?: { x: number; y: number };
  } | null>(null);
  const [selectedInteraction, setSelectedInteraction] = useState<{
    key: string;
    coordinate?: { x: number; y: number };
  } | null>(null);
  const clearInteraction = () => {
    setHoveredInteraction(null);
    setSelectedInteraction(null);
  };
  const [chartBounds, setChartBounds] = useState({ width: 0, height: 0 });

  const chartWidth = Math.max(points.length * widthPerPoint, minWidth);
  const chartData = useMemo<ChartRow[]>(
    () =>
      points.map((point) => ({
        key: point.key,
        label: point.label,
        rangeLabel: point.rangeLabel,
        ...point.values,
      })),
    [points],
  );
  const pointByKey = useMemo(
    () =>
      new Map(points.map((point) => [point.key, point])),
    [points],
  );
  const valueRange = useMemo(() => {
    const flattenedValues = chartData.flatMap((row) =>
      series
        .map((entry) => Number(row[entry.key]))
        .filter((value) => Number.isFinite(value)),
    );
    const nextMin = flattenedValues.length > 0 ? Math.min(...flattenedValues) : 0;
    const nextMax = flattenedValues.length > 0 ? Math.max(...flattenedValues) : 1;
    return {
      min: nextMin,
      max: nextMax,
    };
  }, [chartData, series]);

  const activeInteraction = hoveredInteraction ?? selectedInteraction ?? null;
  const activeKey = activeInteraction?.key ?? null;
  const activePoint = activeKey ? pointByKey.get(activeKey) ?? null : null;
  const activeSummary = activePoint ? renderSummary(activePoint) : null;

  useEffect(() => {
    const element = chartSurfaceRef.current;
    if (!element) {
      return;
    }

    const updateBounds = () => {
      setChartBounds({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const activeBubble = useMemo(() => {
    if (!activeKey) {
      return null;
    }
    const rowIndex = chartData.findIndex((row) => row.key === activeKey);
    if (rowIndex < 0 || chartBounds.width <= 0 || chartBounds.height <= 0) {
      return null;
    }

    const fallbackInnerWidth = Math.max(chartBounds.width - CHART_MARGIN.left - CHART_MARGIN.right, 1);
    const fallbackInnerHeight = Math.max(chartBounds.height - CHART_MARGIN.top - CHART_MARGIN.bottom, 1);
    const fallbackX =
      chartData.length <= 1
        ? CHART_MARGIN.left + fallbackInnerWidth / 2
        : CHART_MARGIN.left + (fallbackInnerWidth * rowIndex) / (chartData.length - 1);
    const pointValues = series
      .map((entry) => Number(chartData[rowIndex]?.[entry.key]))
      .filter((value) => Number.isFinite(value));
    const anchorValue = pointValues.length > 0 ? Math.max(...pointValues) : 0;
    const domainSpan = Math.max(valueRange.max - valueRange.min, 1);
    const fallbackY = CHART_MARGIN.top + fallbackInnerHeight * (1 - (anchorValue - valueRange.min) / domainSpan);
    const x = activeInteraction?.coordinate?.x ?? fallbackX;
    const y = fallbackY;
    const placement = y > chartBounds.height / 2 ? "above" : "below";
    const pivotX = chartBounds.width * BUBBLE_PIVOT_RATIO;
    const directionBias = pivotX > 0 ? (pivotX - x) / pivotX : 0;
    const desiredLeft = x - BUBBLE_WIDTH / 2 + directionBias * BUBBLE_HORIZONTAL_SHIFT;
    const bubbleLeft = clamp(
      desiredLeft,
      BUBBLE_EDGE_PADDING,
      Math.max(chartBounds.width - BUBBLE_WIDTH - BUBBLE_EDGE_PADDING, BUBBLE_EDGE_PADDING),
    );
    const arrowLeft = clamp(x - bubbleLeft, 16, BUBBLE_WIDTH - 16);

    return {
      key: activeKey,
      x,
      y,
      placement,
      bubbleLeft,
      arrowLeft,
    };
  }, [
    activeInteraction?.coordinate?.x,
    activeKey,
    chartBounds.height,
    chartBounds.width,
    chartData,
    series,
    valueRange.max,
    valueRange.min,
  ]);

  return (
    <>
      <div className="-mx-1 mt-0 overflow-x-auto overflow-y-visible px-2 pb-2 pt-0 sm:px-3 sm:pb-3 sm:pt-0">
        <div className="px-1 sm:px-2" style={{ minWidth: `${chartWidth}px` }}>
          <div
            ref={chartSurfaceRef}
            className="relative z-20 h-[17rem] overflow-visible px-1 py-0 sm:h-[15rem] sm:px-2 sm:py-0 lg:h-[14rem] lg:px-3 lg:py-1"
            role="img"
            aria-label={ariaLabel}
            tabIndex={0}
            onBlur={clearInteraction}
            onMouseLeave={clearInteraction}
          >
            {activeSummary && activeBubble ? (
              <div
                className="pointer-events-none absolute z-[80] w-56 rounded-2xl border border-border bg-surface px-3 py-3 shadow-overlay"
                style={{
                  left: `${activeBubble.bubbleLeft}px`,
                  top: `${activeBubble.y}px`,
                  transform:
                    activeBubble.placement === "above"
                      ? "translateY(calc(-100% - 0.75rem))"
                      : "translateY(0.75rem)",
                }}
              >
                <p className="truncate text-xs font-semibold text-foreground" title={activeSummary.rangeLabel}>
                  {activeSummary.rangeLabel}
                </p>
                <div className="mt-2 grid gap-1.5">
                  {activeSummary.items.map((item) => (
                    <div key={`${activeSummary.rangeLabel}-bubble-${item.label}`} className="flex items-start justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className={`text-right font-semibold ${item.valueClassName ?? "text-foreground"}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
                <span
                  className="absolute h-3 w-3 -translate-x-1/2 rotate-45 border-border bg-surface"
                  style={
                    activeBubble.placement === "above"
                      ? {
                          top: "100%",
                          left: `${activeBubble.arrowLeft}px`,
                          transform: "translate(-50%, -50%) rotate(45deg)",
                          borderBottomWidth: "1px",
                          borderRightWidth: "1px",
                        }
                      : {
                          top: "0.75rem",
                          left: `${activeBubble.arrowLeft}px`,
                          transform: "translate(-50%, -50%) rotate(45deg)",
                          borderTopWidth: "1px",
                          borderRightWidth: "1px",
                        }
                  }
                />
              </div>
            ) : null}

            {chartBounds.width > 0 && chartBounds.height > 0 ? (
              <LineChart
                width={chartBounds.width}
                height={chartBounds.height}
                data={chartData}
                margin={CHART_MARGIN}
                onMouseMove={(state) => {
                  const nextKey = resolveInteractionKey(state as ChartInteractionState, chartData);
                  if (!nextKey) {
                    setHoveredInteraction(null);
                    return;
                  }

                  setHoveredInteraction({
                    key: nextKey,
                    coordinate:
                      typeof state.activeCoordinate?.x === "number" && typeof state.activeCoordinate?.y === "number"
                        ? { x: state.activeCoordinate.x, y: state.activeCoordinate.y }
                        : undefined,
                  });
                }}
                onMouseLeave={() => {
                  setHoveredInteraction(null);
                }}
                onClick={(state) => {
                  const nextKey = resolveInteractionKey(state as ChartInteractionState, chartData);
                  if (typeof nextKey === "string") {
                    setSelectedInteraction({
                      key: nextKey,
                      coordinate:
                        typeof state.activeCoordinate?.x === "number" && typeof state.activeCoordinate?.y === "number"
                          ? { x: state.activeCoordinate.x, y: state.activeCoordinate.y }
                          : undefined,
                    });
                  }
                }}
              >
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} strokeDasharray="3 7" className="text-border/70" />
                <XAxis
                  dataKey="label"
                  axisLine={{ stroke: "currentColor", strokeOpacity: 0.38, strokeWidth: 2 }}
                  tickLine={false}
                  tickMargin={8}
                  className="text-[8px] font-medium text-muted-foreground"
                />
                <YAxis
                  axisLine={{ stroke: "currentColor", strokeOpacity: 0.38, strokeWidth: 2 }}
                  tickLine={false}
                  tickMargin={8}
                  width={30}
                  domain={[valueRange.min, valueRange.max]}
                  className="text-[8px] font-medium text-muted-foreground"
                />
                <Tooltip
                  content={<HiddenTooltip />}
                  cursor={{ stroke: "currentColor", strokeOpacity: 0.08 }}
                  wrapperStyle={{ display: "none" }}
                  isAnimationActive={false}
                />
                {series.map((entry) => {
                  const stroke = resolveLineColor(entry.lineClassName);
                  const dotFill = resolveDotColor(entry.dotClassName);
                  return (
                    <Line
                      key={entry.key}
                      type="monotone"
                      dataKey={entry.key}
                      stroke={stroke}
                      strokeWidth={entry.strokeWidth ?? 2.5}
                      dot={({ cx, cy, payload }) => {
                        if (typeof cx !== "number" || typeof cy !== "number") {
                          return null;
                        }
                        const active = payload?.key === activeKey;
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={active ? 5 : 3.5}
                            fill={dotFill}
                          />
                        );
                      }}
                      activeDot={{ r: 5, fill: dotFill }}
                    />
                  );
                })}
              </LineChart>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
