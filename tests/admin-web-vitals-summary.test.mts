import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { toAdminWebVitalSummary } from "../src/lib/admin-performance.ts";

test("관리자 RUM p75 요약은 누락 표본을 목표 충족으로 보지 않는다", () => {
  const summary = toAdminWebVitalSummary([
    {
      metric: "INP",
      sampleCount: "12",
      p75Value: "199.6",
      goodCount: 10,
      needsImprovementCount: 2,
      poorCount: 0,
    },
    {
      metric: "LCP",
      sampleCount: 4,
      p75Value: 2501,
    },
  ]);

  assert.deepEqual(
    summary.map(({ metric, sampleCount, p75Value, status }) => ({
      metric,
      sampleCount,
      p75Value,
      status,
    })),
    [
      { metric: "INP", sampleCount: 12, p75Value: 199.6, status: "met" },
      { metric: "LCP", sampleCount: 4, p75Value: 2501, status: "exceeded" },
      { metric: "TTFB", sampleCount: 0, p75Value: null, status: "unknown" },
    ],
  );
});

test("관리자 RUM 요약은 서버 집계와 원시 이벤트 비노출 계약을 유지한다", async () => {
  const [serverSource, migrationSource] = await Promise.all([
    readFile(new URL("../src/lib/admin-web-vitals-summary.server.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/20260726065438_add_admin_web_vitals_summary.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(serverSource, /get_admin_web_vitals_summary/);
  assert.match(serverSource, /toAdminWebVitalSummary/);
  assert.match(migrationSource, /percentile_cont\(0\.75\)/);
  assert.match(migrationSource, /event_logs_admin_web_vital_created_at_idx/);
  assert.match(migrationSource, /grant execute .* to service_role/i);
});
