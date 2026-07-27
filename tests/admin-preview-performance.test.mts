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
    statusCounts: { "200": 2, "503": 1 },
    totalP95Ms: 290,
    serverTimingP95Ms: { auth: 19.5, query: 240 },
  });
});

test("관리자 Preview 페이지 target은 관리자 경로와 고유 key만 허용한다", async () => {
  const { parseAdminPreviewTargetList } = await performanceModulePromise;
  const defaults = [{ key: "admin.page", path: "/admin" }];

  assert.deepEqual(parseAdminPreviewTargetList("", {
    defaultTargets: defaults,
    errorCode: "INVALID",
    pathPrefix: "/admin",
  }), defaults);
  assert.deepEqual(parseAdminPreviewTargetList(JSON.stringify([
    { key: "admin.members.page", path: "/admin/members" },
  ]), {
    defaultTargets: defaults,
    errorCode: "INVALID",
    pathPrefix: "/admin",
  }), [{ key: "admin.members.page", path: "/admin/members" }]);

  for (const invalid of [
    [{ key: "admin.page", path: "/administrator" }],
    [{ key: "admin.page", path: "/admin#fragment" }],
    [
      { key: "admin.page", path: "/admin" },
      { key: "admin.page", path: "/admin/members" },
    ],
  ]) {
    assert.throws(() => parseAdminPreviewTargetList(JSON.stringify(invalid), {
      defaultTargets: defaults,
      errorCode: "INVALID",
      pathPrefix: "/admin",
    }), /INVALID/);
  }
});

test("페이지 응답은 인증 redirect를 성공으로 세지 않는다", async () => {
  const { summarizeHttpSamples } = await performanceModulePromise;
  assert.deepEqual(summarizeHttpSamples([
    { status: 200, totalMs: 100, serverTiming: {} },
    { status: 302, totalMs: 20, serverTiming: {} },
  ], { isSuccessful: (sample: { status: number }) => sample.status === 200 }), {
    requestCount: 2,
    successCount: 1,
    errorCount: 1,
    statusCounts: { "200": 1, "302": 1 },
    totalP95Ms: 96,
    serverTimingP95Ms: {},
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
  assert.match(source, /authenticated page and API probes/);
  assert.match(source, /ADMIN_PREVIEW_SESSION_COOKIE/);
  assert.match(source, /ADMIN_PREVIEW_PROTECTION_BYPASS/);
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
  assert.match(migrationSource, /as p75_duration_ms[\s\S]*order by dimensioned_events\.viewport, p75_duration_ms/);
  assert.match(migrationSource, /as start_count[\s\S]*order by task_events\.viewport, start_count/);
  assert.match(migrationSource, /grant execute .* to service_role/i);
});
