"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
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

type ActiveBubbleState = {
  key: string;
  x: number;
  y: number;
  placement: "above" | "below";
};

const CHART_MARGIN = {
  top: 28,
  right: 40,
  bottom: 28,
  left: 40,
};

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
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredBubble, setHoveredBubble] = useState<ActiveBubbleState | null>(null);
  const [selectedBubble, setSelectedBubble] = useState<ActiveBubbleState | null>(null);
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
  const valueMax = useMemo(() => {
    const flattenedValues = chartData.flatMap((row) =>
      series
        .map((entry) => Number(row[entry.key]))
        .filter((value) => Number.isFinite(value)),
    );
    return Math.max(...flattenedValues, 0, 1);
  }, [chartData, series]);

  const activeKey = hoveredKey ?? selectedKey ?? points[points.length - 1]?.key ?? null;
  const activePoint = activeKey ? pointByKey.get(activeKey) ?? null : null;
  const activeSummary = activePoint ? renderSummary(activePoint) : null;
  const activeBubble = hoveredBubble ?? selectedBubble;

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

  const buildBubbleState = (rowKey: string): ActiveBubbleState | null => {
    const rowIndex = chartData.findIndex((row) => row.key === rowKey);
    if (rowIndex < 0 || chartBounds.width <= 0 || chartBounds.height <= 0) {
      return null;
    }

    const innerWidth = Math.max(chartBounds.width - CHART_MARGIN.left - CHART_MARGIN.right, 1);
    const innerHeight = Math.max(chartBounds.height - CHART_MARGIN.top - CHART_MARGIN.bottom, 1);
    const x =
      chartData.length <= 1
        ? CHART_MARGIN.left + innerWidth / 2
        : CHART_MARGIN.left + (innerWidth * rowIndex) / (chartData.length - 1);
    const pointValues = series
      .map((entry) => Number(chartData[rowIndex]?.[entry.key]))
      .filter((value) => Number.isFinite(value));
    const anchorValue = pointValues.length > 0 ? Math.max(...pointValues) : 0;
    const y = CHART_MARGIN.top + innerHeight * (1 - anchorValue / valueMax);
    const placement = y > chartBounds.height / 2 ? "above" : "below";

    return {
      key: rowKey,
      x,
      y,
      placement,
    };
  };

  return (
    <>
      <div className="-mx-1 mt-3 overflow-x-auto overflow-y-visible px-3 pb-8 pt-10 sm:px-4 sm:pb-10 sm:pt-12">
        <div className="px-3 sm:px-4" style={{ minWidth: `${chartWidth}px` }}>
          <div
            ref={chartSurfaceRef}
            className="relative z-20 h-[20rem] overflow-visible px-2 py-2 sm:h-[18rem] sm:px-3 sm:py-3 lg:h-[16rem] lg:px-4 lg:py-4"
            role="img"
            aria-label={ariaLabel}
          >
            {activeSummary && activeBubble ? (
              <div
                className="pointer-events-none absolute z-[80] w-56 -translate-x-1/2 rounded-2xl border border-border bg-surface px-3 py-3 shadow-overlay"
                style={{
                  left: `clamp(7rem, ${activeBubble.x}px, calc(100% - 7rem))`,
                  top: `${activeBubble.y}px`,
                  transform:
                    activeBubble.placement === "above"
                      ? "translate(-50%, calc(-100% - 1.5rem))"
                      : "translate(-50%, 1.25rem)",
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
                  className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-border bg-surface"
                  style={
                    activeBubble.placement === "above"
                      ? {
                          top: "100%",
                          transform: "translate(-50%, -50%) rotate(45deg)",
                          borderBottomWidth: "1px",
                          borderRightWidth: "1px",
                        }
                      : {
                          bottom: "100%",
                          transform: "translate(-50%, 50%) rotate(45deg)",
                          borderTopWidth: "1px",
                          borderLeftWidth: "1px",
                        }
                  }
                />
              </div>
            ) : null}

            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={CHART_MARGIN}
                onMouseMove={(state) => {
                  const activeTooltipIndex = state.activeTooltipIndex;
                  const nextRow =
                    typeof activeTooltipIndex === "number"
                      ? chartData[activeTooltipIndex] ?? null
                      : null;
                  if (typeof nextRow?.key === "string") {
                    setHoveredKey(nextRow.key);
                    setHoveredBubble(buildBubbleState(nextRow.key));
                  } else {
                    setHoveredKey(null);
                    setHoveredBubble(null);
                  }
                }}
                onMouseLeave={() => {
                  setHoveredKey(null);
                  setHoveredBubble(null);
                }}
                onClick={(state) => {
                  const activeTooltipIndex = state.activeTooltipIndex;
                  const nextRow =
                    typeof activeTooltipIndex === "number"
                      ? chartData[activeTooltipIndex] ?? null
                      : null;
                  if (typeof nextRow?.key === "string") {
                    setSelectedKey(nextRow.key);
                    setSelectedBubble(buildBubbleState(nextRow.key));
                  }
                }}
              >
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} strokeDasharray="3 7" className="text-border/70" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                  className="text-[8px] font-medium text-muted-foreground"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                  width={30}
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
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
