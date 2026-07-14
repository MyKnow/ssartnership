import assert from "node:assert/strict";
import test from "node:test";

const activityLogsModulePromise = import(
  new URL("../src/lib/activity-log-targets.ts", import.meta.url).href
);

test("partner product targets preserve only real partner UUIDs for rollup triggers", async () => {
  const { sanitizeProductEventTargetId } = await activityLogsModulePromise;
  const partnerId = "d46d0f71-fb92-4a73-b0b6-40c44e5e18d6";

  assert.equal(sanitizeProductEventTargetId("partner", partnerId), partnerId);
  assert.equal(sanitizeProductEventTargetId("partner", "health-001"), null);
  assert.equal(sanitizeProductEventTargetId("company", "company-001"), "company-001");
});
