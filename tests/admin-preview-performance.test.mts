import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const performanceModulePromise = import(
  new URL("../scripts/admin-preview-performance-lib.mjs", import.meta.url).href,
);

test("관리자 Preview 성능 runner는 p75와 최소 표본 상태를 안전하게 계산한다", async () => {
  const {
    percentile,
    summarizeWebVitals,
    summarizeRouteTiming,
    summarizeTaskOutcome,
    summarizeViewportRouteTiming,
    summarizeViewportTaskOutcome,
    summarizeViewportWebVitals,
  } = await performanceModulePromise;

  assert.equal(percentile([10, 20, 30, 40], 0.75), 32.5);
  assert.deepEqual(summarizeWebVitals([
    { metric: "INP", sample_count: 30, p75_value: 199 },
    { metric: "LCP", sample_count: 30, p75_value: 2_501 },
  ]), [
    { metric: "INP", sampleCount: 30, p75Value: 199, threshold: 200, status: "met" },
    { metric: "LCP", sampleCount: 30, p75Value: 2_501, threshold: 2_500, status: "exceeded" },
    { metric: "TTFB", sampleCount: 0, p75Value: null, threshold: 800, status: "unknown" },
  ]);
  assert.equal(summarizeRouteTiming([
    { route_key: "admin.members", sample_count: 29, p75_duration_ms: 180 },
  ])[0].status, "insufficient_sample");
  assert.equal(summarizeTaskOutcome([
    { task_key: "admin.members.search", start_count: 30, p75_duration_ms: 205 },
  ])[0].status, "exceeded");
  assert.deepEqual(summarizeViewportWebVitals([
    { viewport: "mobile", metric: "INP", sample_count: 30, p75_value: 180 },
  ])[0], {
    viewport: "mobile",
    metric: "INP",
    sampleCount: 30,
    p75Value: 180,
    threshold: 200,
    status: "met",
  });
  assert.equal(summarizeViewportRouteTiming([
    { viewport: "tablet", route_key: "admin.members", sample_count: 1, p75_duration_ms: 90 },
  ])[0].viewport, "tablet");
  assert.equal(summarizeViewportTaskOutcome([
    { viewport: "desktop", task_key: "admin.members.search", start_count: 1, p75_duration_ms: 90 },
  ])[0].viewport, "desktop");
});

test("관리자 Preview HTTP runner는 Server-Timing의 허용 phase만 요약한다", async () => {
  const { summarizeHttpSamples } = await performanceModulePromise;
  const summary = summarizeHttpSamples([
    { status: 200, totalMs: 100, serverTiming: { auth: 10, query: 80, secret: 999 } },
    { status: 503, totalMs: 300, serverTiming: { auth: 20, query: 250 } },
    { status: 200, totalMs: 200, serverTiming: { auth: 15, query: 150 } },
  ]);

  assert.deepEqual(summary, {
    requestCount: 3,
    successCount: 2,
    errorCount: 1,
    totalP95Ms: 290,
    serverTimingP95Ms: { auth: 19.5, query: 240 },
  });
});

test("Preview 성능 workflow는 dev와 명시적 확인 문자열에서만 실행된다", async () => {
  const source = await readFile(
    new URL("../.github/workflows/admin-performance.yml", import.meta.url),
    "utf8",
  );

  assert.match(source, /github\.ref == 'refs\/heads\/dev'/);
  assert.match(source, /MEASURE_ADMIN_PERFORMANCE/);
  assert.match(source, /SUPABASE_PREVIEW_SERVICE_ROLE_KEY/);
  assert.match(source, /ADMIN_PREVIEW_SESSION_COOKIE/);
  assert.match(source, /npm run measure:admin:preview/);
});

test("Preview 성능 dimension 집계는 viewport별 p75 계약을 유지한다", async () => {
  const migrationSource = await readFile(
    new URL(
      "../supabase/migrations/20260727142557_add_admin_performance_dimension_summaries.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migrationSource, /get_admin_web_vitals_dimension_summary/);
  assert.match(migrationSource, /get_admin_route_timing_dimension_summary/);
  assert.match(migrationSource, /get_admin_task_outcome_dimension_summary/);
  assert.match(migrationSource, /'mobile', 'tablet', 'desktop'/);
  assert.match(migrationSource, /percentile_cont\(0\.75\)/);
  assert.match(migrationSource, /grant execute .* to service_role/i);
});
