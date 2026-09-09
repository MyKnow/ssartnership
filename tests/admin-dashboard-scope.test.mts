import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("admin dashboard regional scope", () => {
  it("delegates scoped dashboard counts to a server-side read model", async () => {
    const [pageSource, readModelSource] = await Promise.all([
      readFile(
        new URL("../src/app/admin/(protected)/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/lib/admin-dashboard-home.server.ts", import.meta.url),
        "utf8",
      ),
    ]);

    assert.match(pageSource, /getAdminDashboardHomeData/);
    assert.doesNotMatch(pageSource, /getSupabaseAdminClient/);
    assert.doesNotMatch(pageSource, /collectPagedRows/);
    assert.doesNotMatch(pageSource, /loadScopedPartnerIds/);
    assert.match(readModelSource, /fetchAdminDashboardHomeSnapshot/);
    assert.match(readModelSource, /getSupabaseAdminClient/);
  });
});
