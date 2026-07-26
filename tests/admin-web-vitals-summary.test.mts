import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { toAdminWebVitalSummary } from "../src/lib/admin-performance.ts";

test("관리자 RUM p75 요약은 누락 표본을 목표 충족으로 보지 않는다", () => {
  const summary = toAdminWebVitalSummary([
    {
      metric: "INP",
      sampleCount: "29",
      p75Value: "199.6",
      goodCount: 24,
      needsImprovementCount: 5,
      poorCount: 0,
    },
    {
      metric: "LCP",
      sampleCount: 30,
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
      {
        metric: "INP",
        sampleCount: 29,
        p75Value: 199.6,
        status: "insufficient_sample",
      },
      { metric: "LCP", sampleCount: 30, p75Value: 2501, status: "exceeded" },
      { metric: "TTFB", sampleCount: 0, p75Value: null, status: "unknown" },
    ],
  );
});

test("관리자 RUM p75 요약은 최소 표본을 만족한 후에만 목표를 판정한다", async () => {
  const { ADMIN_WEB_VITAL_MIN_SAMPLE_COUNT } = await import(
    new URL("../src/lib/admin-performance.ts", import.meta.url).href,
  );

  assert.equal(ADMIN_WEB_VITAL_MIN_SAMPLE_COUNT, 30);
});

test("관리자 RUM 요약은 서버 집계와 원시 이벤트 비노출 계약을 유지한다", async () => {
  const [serverSource, migrationSource, panelSource] = await Promise.all([
    readFile(new URL("../src/lib/admin-web-vitals-summary.server.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/20260726065438_add_admin_web_vitals_summary.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/AdminWebVitalSummaryPanel.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(serverSource, /get_admin_web_vitals_summary/);
  assert.match(serverSource, /toAdminWebVitalSummary/);
  assert.match(panelSource, /ADMIN_WEB_VITAL_MIN_SAMPLE_COUNT/);
  assert.match(migrationSource, /percentile_cont\(0\.75\)/);
  assert.match(migrationSource, /event_logs_admin_web_vital_created_at_idx/);
  assert.match(migrationSource, /grant execute .* to service_role/i);
});
