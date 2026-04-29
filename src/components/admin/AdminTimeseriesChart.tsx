"use client";

import { useMemo, useState } from "react";
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
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredBubble, setHoveredBubble] = useState<ActiveBubbleState | null>(null);
  const [selectedBubble, setSelectedBubble] = useState<ActiveBubbleState | null>(null);

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

  const activeKey = hoveredKey ?? selectedKey ?? points[points.length - 1]?.key ?? null;
  const activePoint = activeKey ? pointByKey.get(activeKey) ?? null : null;
  const activeSummary = activePoint ? renderSummary(activePoint) : null;
  const activeBubble = hoveredBubble ?? selectedBubble;

  return (
    <>
      <div className="-mx-1 mt-3 overflow-x-auto overflow-y-visible pb-8 pt-12">
        <div className="px-1" style={{ minWidth: `${chartWidth}px` }}>
          <div
            className="relative z-20 h-[12.5rem] overflow-visible sm:h-[10.5rem] lg:h-[9rem]"
            role="img"
            aria-label={ariaLabel}
          >
            {activeSummary && activeBubble ? (
              <div
                className="pointer-events-none absolute z-50 w-56 -translate-x-1/2 -translate-y-[calc(100%+1rem)] rounded-2xl border border-border bg-surface px-3 py-3 shadow-overlay"
                style={{
                  left: `clamp(5.5rem, ${activeBubble.x}px, calc(100% - 5.5rem))`,
                  top: `${Math.max(activeBubble.y - 4, 28)}px`,
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
                <span className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-border bg-surface" />
              </div>
            ) : null}

            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 14, right: 18, bottom: 16, left: 0 }}
                onMouseMove={(state) => {
                  const activeTooltipIndex = state.activeTooltipIndex;
                  const nextRow =
                    typeof activeTooltipIndex === "number"
                      ? chartData[activeTooltipIndex] ?? null
                      : null;
                  const nextCoordinate = state.activeCoordinate;
                  if (
                    typeof nextRow?.key === "string" &&
                    nextCoordinate &&
                    typeof nextCoordinate.x === "number" &&
                    typeof nextCoordinate.y === "number"
                  ) {
                    setHoveredKey(nextRow.key);
                    setHoveredBubble({
                      key: nextRow.key,
                      x: nextCoordinate.x,
                      y: nextCoordinate.y,
                    });
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
                  const nextCoordinate = state.activeCoordinate;
                  if (
                    typeof nextRow?.key === "string" &&
                    nextCoordinate &&
                    typeof nextCoordinate.x === "number" &&
                    typeof nextCoordinate.y === "number"
                  ) {
                    setSelectedKey(nextRow.key);
                    setSelectedBubble({
                      key: nextRow.key,
                      x: nextCoordinate.x,
                      y: nextCoordinate.y,
                    });
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
