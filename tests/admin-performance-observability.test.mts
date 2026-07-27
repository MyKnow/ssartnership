import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const performanceModulePromise = import(
  new URL("../src/lib/admin-performance.ts", import.meta.url).href,
) as Promise<typeof import("../src/lib/admin-performance.ts")>;

test("관리자 성능 RUM은 Core Web Vitals만 안전하게 정규화한다", async () => {
  const { isAdminWebVitalName, toAdminWebVitalProperties } = await performanceModulePromise;

  assert.equal(isAdminWebVitalName("INP"), true);
  assert.equal(isAdminWebVitalName("LCP"), true);
  assert.equal(isAdminWebVitalName("custom_duration"), false);
  assert.deepEqual(
    toAdminWebVitalProperties({ name: "INP", rating: "good", value: 198.7 }),
    { metric: "INP", rating: "good", value: 199 },
  );
  assert.deepEqual(
    toAdminWebVitalProperties({ name: "LCP", rating: "poor", value: -1 }),
    { metric: "LCP", rating: "poor", value: 0 },
  );
});

test("관리자 route timing은 동적 식별자를 고정된 화면 키로 치환한다", async () => {
  const { getAdminRouteDescriptor, toAdminRouteTimingProperties } =
    await performanceModulePromise;

  assert.deepEqual(
    getAdminRouteDescriptor(
      "/admin/partners/f17d94c1-cbe9-4836-af4a-7c9d750aba41?returnTo=%2Fadmin",
    ),
    { path: "/admin/partners/[partnerId]", key: "admin.partners.detail" },
  );
  assert.deepEqual(getAdminRouteDescriptor("/admin/members/mock"), {
    path: "/admin/members/mock",
    key: "admin.members.mock",
  });
  assert.equal(getAdminRouteDescriptor("/auth/login"), null);
  assert.deepEqual(
    toAdminRouteTimingProperties({
      durationMs: 200.8,
      outcome: "complete",
      trigger: "link",
    }),
    { durationMs: 201, outcome: "complete", trigger: "link" },
  );
  assert.deepEqual(
    toAdminRouteTimingProperties({
      durationMs: Number.POSITIVE_INFINITY,
      outcome: "server-error",
      trigger: "unknown",
    }),
    { durationMs: 0, outcome: "unknown", trigger: "programmatic" },
  );
});

test("관리자 Web Vitals 이벤트는 명시적으로 허용된 안전한 client event다", async () => {
  const source = await readFile(
    new URL("../src/lib/product-event-contract.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /"admin_web_vital"/);
  assert.match(source, /"admin_route_timing"/);
});

test("관리자 레이아웃은 전역 성능 계측을 관리자 route로 한정한다", async () => {
  const layoutSource = await readFile(
    new URL("../src/app/admin/layout.tsx", import.meta.url),
    "utf8",
  );
  const reporterSource = await readFile(
    new URL("../src/components/analytics/AdminWebVitals.tsx", import.meta.url),
    "utf8",
  );
  const navigationSource = await readFile(
    new URL("../src/components/analytics/AdminNavigationTiming.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layoutSource, /<AdminWebVitals\s*\/>/);
  assert.match(reporterSource, /useReportWebVitals/);
  assert.match(reporterSource, /admin_web_vital/);
  assert.match(layoutSource, /<AdminNavigationTiming\s*\/>/);
  assert.match(navigationSource, /admin_route_timing/);
  assert.match(navigationSource, /history\.pushState/);
  assert.match(navigationSource, /useSearchParams/);
  assert.match(navigationSource, /window\.location\.search/);
});

test("한 관리자 요청 안의 세션 조회는 재사용해 셸·페이지의 중복 계정 조회를 막는다", async () => {
  const authSource = await readFile(
    new URL("../src/lib/auth.ts", import.meta.url),
    "utf8",
  );

  assert.match(authSource, /import\s+\{\s*cache\s*\}\s+from\s+["']react["']/);
  assert.match(authSource, /export const getAdminSession = cache\(/);
});
