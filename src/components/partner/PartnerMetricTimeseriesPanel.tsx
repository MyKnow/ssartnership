"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import FormMessage from "@/components/ui/FormMessage";
import Tabs from "@/components/ui/Tabs";
import TimeseriesLineChart from "@/components/ui/TimeseriesLineChart";
import type {
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
          <TimeseriesLineChart
            points={currentSeries.points.map((point) => ({
              key: point.label,
              label: point.label,
              values: {
                pv: point.pv,
                uv: point.uv,
                cta: point.cta,
                denominator: point.denominator,
              },
            }))}
            series={SERIES_CONFIG.map((series) => ({
              key: series.key,
              label: series.label,
              lineClassName: series.lineClassName,
              circleClassName: series.circleClassName,
            }))}
            ariaLabel={`${currentSeries.granularity === "hour" ? "시간별" : "요일별"} 평균 PV, UV, CTA 차트`}
            renderTooltip={(point) => ({
              title: point.label,
              items: [
                {
                  label: "PV 평균",
                  value: formatAverage(Number(point.values.pv ?? 0)),
                  valueClassName: "font-medium text-primary",
                },
                {
                  label: "UV 평균",
                  value: formatAverage(Number(point.values.uv ?? 0)),
                  valueClassName: "font-medium text-warning",
                },
                {
                  label: "CTA 평균",
                  value: formatAverage(Number(point.values.cta ?? 0)),
                  valueClassName: "font-medium text-success",
                },
                {
                  label: "표본",
                  value: formatCount(Number(point.values.denominator ?? 0)),
                },
              ],
            })}
          />
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
