import assert from "node:assert/strict";
import test from "node:test";

import { shouldUseDbPagedAdminLogList } from "@/lib/log-insights";
import {
  PAGE_MAX_LOG_ROWS_PER_GROUP,
  SUMMARY_MAX_LOG_ROWS_PER_GROUP,
} from "@/lib/log-insights/shared";

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

test("admin log fallback row loads stay bounded", () => {
  assert.equal(typeof PAGE_MAX_LOG_ROWS_PER_GROUP, "number");
  assert.equal(typeof SUMMARY_MAX_LOG_ROWS_PER_GROUP, "number");
  assert.ok(PAGE_MAX_LOG_ROWS_PER_GROUP > 0);
  assert.ok(SUMMARY_MAX_LOG_ROWS_PER_GROUP > 0);
  assert.ok(SUMMARY_MAX_LOG_ROWS_PER_GROUP <= PAGE_MAX_LOG_ROWS_PER_GROUP);
});

test("admin log page size options do not expose the previous 500 row choice", async () => {
  const [serverSource, clientSource] = await Promise.all([
    import("node:fs/promises").then(({ readFile }) =>
      readFile(new URL("../src/lib/log-insights.ts", import.meta.url), "utf8"),
    ),
    import("node:fs/promises").then(({ readFile }) =>
      readFile(
        new URL(
          "../src/components/admin/logs-manager/useAdminLogsManager.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  ]);

  assert.doesNotMatch(serverSource, /LOG_PAGE_SIZE_OPTIONS = \[[^\]]*500/);
  assert.doesNotMatch(clientSource, /LOG_PAGE_SIZE_OPTIONS = \[[^\]]*500/);
});
