"use client";

import { useReportWebVitals } from "next/web-vitals";
import { trackProductEvent } from "@/lib/product-events";
import {
  isAdminWebVitalName,
  toAdminWebVitalProperties,
} from "@/lib/admin-performance";

const reportedMetricIds = new Set<string>();

function reportAdminWebVital(metric: {
  id: string;
  name: string;
  rating: string;
  value: number;
}) {
  if (
    typeof window === "undefined" ||
    !window.location.pathname.startsWith("/admin") ||
    !isAdminWebVitalName(metric.name)
  ) {
    return;
  }

  const metricId = `${window.location.pathname}:${metric.id}`;
  if (reportedMetricIds.has(metricId)) {
    return;
  }
  reportedMetricIds.add(metricId);

  trackProductEvent({
    eventName: "admin_web_vital",
    targetType: "admin_performance",
    targetId: metric.name.toLowerCase(),
    properties: toAdminWebVitalProperties(metric),
  });
}

export default function AdminWebVitals() {
  useReportWebVitals(reportAdminWebVital);

  return null;
}
