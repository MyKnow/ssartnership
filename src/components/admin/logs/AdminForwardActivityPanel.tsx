"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Surface from "@/components/ui/Surface";
import { formatActivityWindow } from "@/lib/platform-activity-heatmap";
import type { ForwardActivityMetrics, ForwardActivityPoint } from "@/lib/platform-activity-forward-metrics";

function formatDate(value: string) { return value.replaceAll("-", "."); }
function pointLabel(point: ForwardActivityPoint) {
  return `${formatDate(point.date)} · DAU ${point.memberActiveCount}명 · WAU ${point.memberWau}명 · MAU ${point.memberMau}명`;
}

export default function AdminForwardActivityPanel({ metrics }: { metrics: ForwardActivityMetrics }) {
  const [selectedDate, setSelectedDate] = useState(metrics.asOfDate ?? metrics.dailySeries.at(-1)?.date ?? "");
  const selected = metrics.dailySeries.find((point) => point.date === selectedDate) ?? metrics.dailySeries.at(-1);
  const max = Math.max(1, ...metrics.dailySeries.map((point) => point.memberActiveCount));
  if (!selected) return <Surface level="inset" padding="md"><p className="text-sm text-muted-foreground">활성 회원 집계를 준비하고 있습니다.</p></Surface>;
  const wau = formatActivityWindow({ anchorDate: selected.date, windowDays: 7, observedThrough: selected.wauObservedThrough });
  const mau = formatActivityWindow({ anchorDate: selected.date, windowDays: 30, observedThrough: selected.mauObservedThrough });
  const cards = [
    ["DAU", selected.memberActiveCount, formatDate(selected.date), true],
    ["WAU", selected.memberWau, wau.label, wau.isComplete],
    ["MAU", selected.memberMau, mau.label, mau.isComplete],
  ] as const;
  return <section className="grid min-w-0 gap-4 rounded-panel border border-border/70 bg-surface-elevated p-5 shadow-flat sm:p-6" aria-label="회원 활성도 집계">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-foreground">회원 활성도</h2><p className="mt-1 text-sm text-muted-foreground">로그 조회 범위와 별도로 선택일 기준 이후 기간의 고유 로그인 회원을 계산합니다.</p></div><Badge variant="neutral">기준일 {formatDate(selected.date)}</Badge></div>
    <div className="grid gap-3 sm:grid-cols-3">{cards.map(([label, value, period, complete]) => <Surface key={label} level="inset" padding="md"><p className="ui-kicker">{label}</p><p className="mt-2 text-2xl font-semibold text-foreground">{value.toLocaleString("ko-KR")}명</p><p className="mt-1 text-xs text-muted-foreground">{period}</p>{!complete ? <p className="mt-1 text-xs font-medium text-warning">집계 진행 중 · {label === "WAU" ? wau.observedLabel : mau.observedLabel}</p> : null}</Surface>)}</div>
    <div className="grid gap-3"><div className="flex flex-wrap gap-1.5" role="list" aria-label="일자별 활성 회원 잔디">{metrics.dailySeries.map((point) => { const intensity = Math.max(0.12, point.memberActiveCount / max); return <button key={point.date} type="button" role="listitem" onMouseEnter={() => setSelectedDate(point.date)} onFocus={() => setSelectedDate(point.date)} onClick={() => setSelectedDate(point.date)} aria-label={pointLabel(point)} className={`size-4 rounded-[3px] ring-1 ring-inset ring-border/60 transition hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary ${selected.date === point.date ? "ring-2 ring-primary" : ""}`} style={{ backgroundColor: `rgb(30 86 170 / ${intensity})` }} />; })}</div><p className="rounded-xl bg-surface-inset px-3 py-2 text-sm text-muted-foreground" aria-live="polite">{pointLabel(selected)} · 마우스를 올리거나 선택하면 해당 날짜의 수치를 표시합니다.</p></div>
  </section>;
}
