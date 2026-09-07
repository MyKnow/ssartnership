"use client";

import { useEffect, useState } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { classifyVitalRoute, parseVitalSample } from "@/lib/web-vitals-contract";

function report(metric: { name: string; value: number }) {
  const sample = parseVitalSample({ name: metric.name, value: metric.value, route: classifyVitalRoute(window.location.pathname) });
  if (!sample) return;
  const body = JSON.stringify(sample);
  // Never send metric.id, entries, URL, referrer, member/session identifiers.
  navigator.sendBeacon("/api/web-vitals", new Blob([body], { type: "application/json" }));
}

function Reporter() {
  useReportWebVitals(report);
  return null;
}

export default function SelfHostedWebVitals() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (navigator.doNotTrack === "1") return;
    const controller = new AbortController();
    void fetch("/api/web-vitals", { credentials: "omit", cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((config) => {
        if (config?.enabled === true && typeof config.sampleRate === "number" && config.sampleRate > 0 && config.sampleRate <= 1 && Math.random() < config.sampleRate) setEnabled(true);
      }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  return enabled ? <Reporter /> : null;
}
