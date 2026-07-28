import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ADMIN_PREFETCH_MIN_SAMPLE_COUNT,
  ADMIN_PREFETCH_TARGET_PERCENT,
  toAdminPrefetchSummary,
} from "../src/lib/admin-performance.ts";
import { shouldPrefetchAdminRoute } from "../src/lib/admin-prefetch.ts";

test("관리자 prefetch 활용률은 요청 후 실제 이동 비율을 안전하게 요약한다", () => {
  const metrics = toAdminPrefetchSummary([
    {
      routeKey: "admin.members",
      requestedCount: 10,
      usedCount: 7,
      utilizationRate: 70,
    },
    {
      routeKey: "admin.push",
      requestedCount: 2,
      usedCount: 2,
      utilizationRate: 100,
    },
    {
      routeKey: "admin.unknown/unsafe",
      requestedCount: "not-a-number",
      usedCount: -10,
      utilizationRate: "NaN",
    },
  ]);

  assert.deepEqual(metrics[0], {
    routeKey: "admin.members",
    label: "회원 관리",
    sampleCount: 10,
    usedCount: 7,
    utilizationRate: 70,
    threshold: ADMIN_PREFETCH_TARGET_PERCENT,
    status: "insufficient_sample",
  });
  assert.equal(metrics[1]?.status, "insufficient_sample");
  assert.equal(metrics[2]?.routeKey, "admin.unknown");
  assert.equal(metrics[2]?.utilizationRate, null);
  assert.equal(ADMIN_PREFETCH_MIN_SAMPLE_COUNT, 30);
  assert.equal(shouldPrefetchAdminRoute("admin.members"), true);
  assert.equal(shouldPrefetchAdminRoute("admin.member-signup-requests"), false);
  assert.equal(shouldPrefetchAdminRoute("admin.member-signup-requests.detail"), false);
});

test("prefetch 계측은 요청·활용 단계를 분리하고 raw URL을 보내지 않는다", async () => {
  const intentSource = await readFile(
    new URL("../src/lib/admin-prefetch.ts", import.meta.url),
    "utf8",
  );
  const navigationSource = await readFile(
    new URL("../src/components/analytics/AdminNavigationTiming.tsx", import.meta.url),
    "utf8",
  );
  const intentLinkSource = await readFile(
    new URL("../src/components/admin/AdminIntentLink.tsx", import.meta.url),
    "utf8",
  );
  const shellSource = await readFile(
    new URL("../src/components/admin/AdminShellView.tsx", import.meta.url),
    "utf8",
  );
  const contractSource = await readFile(
    new URL("../src/lib/product-event-contract.ts", import.meta.url),
    "utf8",
  );

  assert.match(intentSource, /admin_prefetch/);
  assert.match(intentSource, /requested/);
  assert.match(intentSource, /used/);
  assert.match(intentSource, /getAdminRouteDescriptor/);
  assert.match(intentSource, /requestAgeMs/);
  assert.match(navigationSource, /consumeAdminPrefetchUsage/);
  assert.match(navigationSource, /const prefetchUsage = consumeAdminPrefetchUsage\(anchor\.href\)/);
  assert.match(navigationSource, /event\.defaultPrevented && !prefetchUsage/);
  assert.match(navigationSource, /prefetch/);
  assert.match(navigationSource, /addEventListener\("click", markFromClick, true\)/);
  assert.match(navigationSource, /removeEventListener\("click", markFromClick, true\)/);
  assert.match(contractSource, /"admin_prefetch"/);
  assert.match(contractSource, /requested|used/);
  assert.doesNotMatch(intentSource, /window\.location\.search/);
  assert.match(intentSource, /ADMIN_PREFETCH_HOVER_DELAY_MS = 120/);
  assert.match(intentLinkSource, /setTimeout/);
  assert.match(intentLinkSource, /onPointerLeave=\{cancelHoverPrefetch\}/);
  assert.match(shellSource, /hoverPrefetchTimersRef/);
  assert.match(shellSource, /onPointerLeave=\{\(\) => cancelHoverPrefetch/);
});

test("Preview 측정과 운영 로그는 prefetch 활용률 요약 RPC를 사용한다", async () => {
  const scriptSource = await readFile(
    new URL("../scripts/admin-preview-performance.mjs", import.meta.url),
    "utf8",
  );
  const migrationSource = await readFile(
    new URL(
      "../supabase/migrations/20260728184935_add_admin_prefetch_summary.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const pageSource = await readFile(
    new URL("../src/app/admin/(protected)/logs/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(scriptSource, /get_admin_prefetch_summary/);
  assert.match(scriptSource, /get_admin_prefetch_dimension_summary/);
  assert.match(migrationSource, /get_admin_prefetch_summary/);
  assert.match(migrationSource, /get_admin_prefetch_dimension_summary/);
  assert.match(pageSource, /getAdminPrefetchSummary/);
});
