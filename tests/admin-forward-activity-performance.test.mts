import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("관리자 활성도 보조 집계는 로그 탐색을 오래 붙잡지 않는다", async () => {
  const [serverSource, migrationSource] = await Promise.all([
    readFile(
      new URL("../src/lib/platform-activity-forward-metrics.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260727025738_optimize_admin_forward_activity_metrics.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(serverSource, /abortSignal\(AbortSignal\.timeout\(/);
  assert.match(serverSource, /ADMIN_FORWARD_ACTIVITY_TIMEOUT_MS = 200/);
  assert.match(serverSource, /logAdminDataUnavailable/);
  assert.doesNotMatch(serverSource, /console\.error/);
  assert.match(migrationSource, /rolling_activity as \(/);
  assert.match(migrationSource, /count\(distinct identities\.identity_hash\)/);
  assert.doesNotMatch(
    migrationSource,
    /left join public\.platform_active_identities as future_identity/,
  );
});
