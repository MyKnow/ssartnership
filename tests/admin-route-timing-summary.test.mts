import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ADMIN_ROUTE_TIMING_MIN_SAMPLE_COUNT,
  toAdminRouteTimingSummary,
} from "../src/lib/admin-performance.ts";

test("관리자 route timing 요약은 안전한 한국어 화면명과 표본 신뢰도를 제공한다", () => {
  const summary = toAdminRouteTimingSummary([
    {
      routeKey: "admin.partners.detail",
      sampleCount: 30,
      p75DurationMs: "241.4",
      completeCount: 28,
      unknownCount: 1,
      errorCount: 1,
    },
    {
      routeKey: "admin.tasks",
      sampleCount: 12,
      p75DurationMs: 120,
      completeCount: 12,
    },
    {
      routeKey: "/admin/members/secret-id",
      sampleCount: 50,
      p75DurationMs: 99,
      completeCount: 50,
    },
  ]);

  assert.equal(ADMIN_ROUTE_TIMING_MIN_SAMPLE_COUNT, 30);
  assert.deepEqual(
    summary.map(({ routeKey, label, sampleCount, p75DurationMs, status }) => ({
      routeKey,
      label,
      sampleCount,
      p75DurationMs,
      status,
    })),
    [
      {
        routeKey: "admin.partners.detail",
        label: "제휴처 상세",
        sampleCount: 30,
        p75DurationMs: 241.4,
        status: "exceeded",
      },
      {
        routeKey: "admin.tasks",
        label: "작업함",
        sampleCount: 12,
        p75DurationMs: 120,
        status: "insufficient_sample",
      },
      {
        routeKey: "admin.unknown",
        label: "기타 관리자 화면",
        sampleCount: 50,
        p75DurationMs: 99,
        status: "met",
      },
    ],
  );
});

test("route timing 집계는 service role 서버 경계와 bounded table을 사용한다", async () => {
  const [serverSource, migrationSource, pageSource, panelSource] =
    await Promise.all([
      readFile(
        new URL(
          "../src/lib/admin-route-timing-summary.server.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../supabase/migrations/20260727020428_add_admin_route_timing_summary.sql",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/app/admin/(protected)/logs/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/components/admin/AdminRouteTimingSummaryPanel.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  assert.match(serverSource, /get_admin_route_timing_summary/);
  assert.match(serverSource, /toAdminRouteTimingSummary/);
  assert.match(migrationSource, /percentile_cont\(0\.75\)/);
  assert.match(migrationSource, /grant execute .* to service_role/i);
  assert.match(pageSource, /getAdminRouteTimingSummary/);
  assert.match(pageSource, /routeTiming={routeTimingPromise}/);
  assert.match(panelSource, /overflow-x-auto/);
  assert.match(panelSource, /role="region"/);
  assert.doesNotMatch(panelSource, /rawPath|memberId|partnerId/);
});
