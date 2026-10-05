"use client";

import { useEffect, useState } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { sendWebVital } from "@/lib/web-vitals-client";

function report(metric: { name: string; value: number }) {
  void sendWebVital(metric, window.location.pathname);
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
