import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { shouldUseDbPagedAdminLogList } from "@/lib/log-insights";

test("로그 explorer는 보조 집계보다 먼저 렌더링할 수 있다", async () => {
  const [pageSource, ancillarySource, dataSource] = await Promise.all([
    readFile(
      new URL("../src/app/admin/(protected)/logs/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/AdminLogsAncillaryPanels.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/log-insights/data.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(pageSource, /<Suspense/);
  assert.match(pageSource, /<AdminLogsAncillaryPanels/);
  assert.ok(
    pageSource.indexOf("<AdminLogsManager initialData={data} initialQuery={initialQuery} />") <
      pageSource.indexOf("<Suspense"),
  );
  assert.match(pageSource, /searchParams\?: AdminLogsSearchParams/);
  assert.match(pageSource, /getFirstSearchParam/);
  assert.match(
    pageSource,
    /const activityPromise = fetchForwardActivityMetrics\(\)/,
  );
  assert.match(
    pageSource,
    /const webVitalsPromise = getAdminWebVitalSummary\(\)/,
  );
  assert.match(
    pageSource,
    /const routeTimingPromise = getAdminRouteTimingSummary\(\)/,
  );
  assert.match(
    pageSource,
    /const taskOutcomePromise = getAdminTaskOutcomeSummary\(\)/,
  );
  assert.match(pageSource, /taskOutcome=\{taskOutcomePromise\}/);
  assert.doesNotMatch(
    pageSource,
    /const \[data, activity, webVitals\] = await Promise\.all/,
  );
  assert.match(ancillarySource, /await Promise\.all/);
  assert.match(ancillarySource, /resolveTaskOutcome/);
  assert.match(ancillarySource, /로그 탐색은 계속 사용할 수 있습니다/);

  const [managerSource, hookSource] = await Promise.all([
    readFile(
      new URL(
        "../src/components/admin/logs-manager/AdminLogsManagerContent.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/logs-manager/useAdminLogsManager.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.doesNotMatch(managerSource, /AdminForwardActivityPanel/);
  assert.doesNotMatch(managerSource, /activityMetrics/);
  assert.match(managerSource, /initialQuery\?: GetAdminLogsPageDataOptions/);
  assert.match(hookSource, /nextCursor/);
  assert.match(hookSource, /cursorByPageRef/);
  assert.match(hookSource, /history\.replaceState/);
  assert.match(dataSource, /get_admin_logs_cursor_scoped/);
  assert.match(dataSource, /cursor rpc unavailable, falling back to page rpc/);
});

test("shouldUseDbPagedAdminLogList allows newest queries including all-group and search filters", () => {
  assert.equal(
    shouldUseDbPagedAdminLogList(
      {
        group: "product",
        sort: "newest",
        search: "",
        name: "all",
        actor: "all",
        status: "all",
      },
      1,
      100,
    ),
    true,
  );

  assert.equal(
    shouldUseDbPagedAdminLogList(
      {
        group: "all",
        sort: "newest",
        search: "kim",
        name: "search_execute",
        actor: "member",
        status: "all",
      },
      1,
      100,
    ),
    true,
  );

  assert.equal(
    shouldUseDbPagedAdminLogList(
      {
        group: "security",
        sort: "newest",
        status: "blocked",
      },
      2,
      100,
    ),
    true,
  );
});

test("shouldUseDbPagedAdminLogList rejects non-newest sort combinations and virtual groups", () => {
  assert.equal(
    shouldUseDbPagedAdminLogList(
      {
        group: "all",
        sort: "oldest",
      },
      1,
      100,
    ),
    false,
  );

  assert.equal(
    shouldUseDbPagedAdminLogList(
      {
        group: "audit",
        sort: "actor",
      },
      1,
      100,
    ),
    false,
  );

  assert.equal(
    shouldUseDbPagedAdminLogList(
      {
        group: "partner",
        sort: "newest",
      },
      1,
      100,
    ),
    false,
  );
});
