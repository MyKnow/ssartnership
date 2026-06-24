import assert from "node:assert/strict";
import test from "node:test";

type PartnerNotificationOperationModule = typeof import("../src/lib/partner-notifications-operation.ts");

const operationModulePromise = import(
  new URL("../src/lib/partner-notifications-operation.ts", import.meta.url).href
) as Promise<PartnerNotificationOperationModule>;

test("partner notification summary declares its recent window scope", async () => {
  const { buildSummary } = await operationModulePromise;
  const summary = buildSummary([], 2, 3);

  assert.equal(summary.scopeLabel, "최근 수집 알림 기준");
  assert.match(summary.scopeDescription, /최근/);
  assert.match(summary.scopeDescription, /20건/);
});
