"use client";

import type { SsafyVerifyClientFailure } from "@/lib/ssafy-verify/client-errors";
import {
  createSsafyVerifyClientFailureReport,
  type SsafyVerifyClientFailurePurpose,
} from "@/lib/ssafy-verify/client-failure-report";

export function reportSsafyVerifyClientFailure(input: {
  purpose: SsafyVerifyClientFailurePurpose;
  failure: SsafyVerifyClientFailure;
}) {
  if (typeof window === "undefined") {
    return;
  }

  void fetch("/api/ssafy/client-failure", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(createSsafyVerifyClientFailureReport(input)),
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}
