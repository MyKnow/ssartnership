import assert from "node:assert/strict";
import test from "node:test";

import { shouldUseDbPagedAdminLogList } from "@/lib/log-insights";

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
