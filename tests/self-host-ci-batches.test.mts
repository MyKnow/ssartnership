import assert from "node:assert/strict";
import test from "node:test";
import { compilerPlan, parseBatch, requireExactInventory, requireStableDevLog, testInventory } from "../deploy/self-host-ci/batch-plan.mjs";

const report = (status = "passed", retry = 0) => ({ errors: [], suites: [{ specs: [{ id: "a", file: "page-smoke.spec.ts", title: "renders /suggest", tests: [{ projectName: "chromium", expectedStatus: "passed", results: [{ status, retry }] }] }] }] });
test("CI batches require one successful zero-retry result for every unique planned ID", () => {
  const expected = testInventory(report());
  requireExactInventory(expected, testInventory(report(), { passed: true }));
  for (const status of ["failed", "timedOut", "skipped", "interrupted"]) assert.throws(() => testInventory(report(status), { passed: true }));
  assert.throws(() => testInventory(report("passed", 1), { passed: true }));
  const contradictory = report();
  Object.assign(contradictory.suites[0].specs[0].tests[0].results[0], { errors: [{ message: "unexpected result error" }] });
  assert.throws(() => testInventory(contradictory, { passed: true }));
  assert.throws(() => requireExactInventory(expected, []));
  assert.throws(() => requireExactInventory(expected, [...expected, ...expected]));
});
test("compiler preparation includes only selected batch routes and rejects unplanned files", () => {
  const plan = compilerPlan(testInventory(report()));
  assert.ok(plan.routes.includes("/suggest"));
  assert.ok(!plan.routes.includes("/api/web-vitals"));
  assert.ok(!plan.routes.includes("/partner-registration"));
  assert.equal(plan.administrator, false);
  assert.equal(compilerPlan([{ id: "admin", file: "admin-console.spec.ts", title: "admin" }]).administrator, true);
  assert.throws(() => compilerPlan([{ id: "new", file: "unreviewed.spec.ts", title: "unknown" }]));
  const entry = compilerPlan([{ id: "entry", file: "auth-ops.spec.ts", title: "manual member setup rejects a missing token" }]);
  assert.equal(entry.routes.at(-1), "/auth/member/setup");
  assert.ok(!entry.routes.includes("/partner/login"));
  const company = compilerPlan([{ id: "company", file: "auth-ops.spec.ts", title: "partner login and change-request entry stay company scoped" }]);
  assert.ok(company.routes.includes("/partner/companies/mock-partner-company-urban-gym/services/mock-partner-service-urban-gym-pt"));
  assert.ok(!company.routes.includes("/partner/services/mock-partner-service-cafe-ssafy-yeoksam/request"));
  assert.ok(compilerPlan([{ id: "home", file: "home-partners.spec.ts", title: "home" }]).routes.includes("/"));
  assert.ok(compilerPlan([{ id: "pwa", file: "pwa-shell.spec.ts", title: "pwa" }]).routes.includes("/"));
  assert.throws(() => compilerPlan([{ id: "new", file: "auth-ops.spec.ts", title: "unknown new auth case" }]));
  assert.equal(parseBatch("16"), 16);
  for (const value of ["0", "17", "01", "../1", undefined]) assert.throws(() => parseBatch(value));
});
test("an internally restarted or corrupt dev server never becomes a passing CI result", () => {
  requireStableDevLog("7 passed");
  for (const line of ["Server is approaching the used memory threshold, restarting...", "Manifest file is empty", "SyntaxError: Unexpected end of JSON input", "JavaScript heap out of memory"]) assert.throws(() => requireStableDevLog(`7 passed\n${line}`));
});
