"use client";

import TimeseriesLineChart from "@/components/ui/TimeseriesLineChart";

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

export default function AdminTimeseriesChart({
  points,
  series,
  ariaLabel,
  minWidth = 320,
  renderSummary,
}: {
  points: AdminTimeseriesPoint[];
  series: AdminTimeseriesSeries[];
  ariaLabel: string;
  minWidth?: number;
  widthPerPoint?: number;
  renderSummary: (point: AdminTimeseriesPoint) => AdminTimeseriesSummary;
}) {
  return (
    <TimeseriesLineChart
      points={points}
      series={series.map((entry) => ({
        key: entry.key,
        label: entry.label,
        lineClassName: entry.lineClassName,
        circleClassName: entry.dotClassName.replace(/^fill-/, "text-"),
        strokeWidth: entry.strokeWidth,
      }))}
      ariaLabel={ariaLabel}
      minWidth={minWidth}
      renderTooltip={(point) => {
        const summary = renderSummary({
          key: point.key,
          label: point.label,
          rangeLabel: point.rangeLabel ?? point.label,
          values: point.values,
        });
        return {
          title: summary.rangeLabel,
          items: summary.items,
        };
      }}
    />
  );
}
