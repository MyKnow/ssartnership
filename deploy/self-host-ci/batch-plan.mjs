export const E2E_BATCHES = 16;
export function requireStableDevLog(log) {
  if (/Server is approaching the used memory threshold|Restarting the server to apply the changes|Manifest file is empty|Unexpected end of JSON input|heap out of memory/u.test(log)) throw new Error("CI_E2E_SERVER_UNSTABLE");
}
export function parseBatch(value, allowZero = false) {
  if (!/^(?:0|[1-9]\d*)$/u.test(String(value)) || Number(value) < (allowZero ? 0 : 1) || Number(value) > E2E_BATCHES) throw new Error("CI_E2E_BATCH_INVALID");
  return Number(value);
}
function authRoutes(title) {
  if (title.startsWith("manual member setup")) return ["/auth/member/setup"];
  if (title.startsWith("uses the canonical partner")) return ["/partners/health-001", "/auth/signup", "/auth/signup/graduate", "/auth/reset"];
  if (title.includes("member login shows")) return [];
  if (title.includes("password reset exposes")) return ["/auth/reset"];
  if (title.startsWith("signup switches")) return ["/auth/signup", "/auth/signup/graduate"];
  if (title.startsWith("Mattermost 가입 인증은")) return ["/auth/signup"];
  if (title.startsWith("keeps graduated-member recovery")) return ["/auth/reset", "/auth/signup/graduate"];
  if (title.startsWith("partner login maps")) return ["/partner/login"];
  if (title.startsWith("partner setup accepts")) return ["/partner/setup/mock-partner-setup-cafe-ssafy"];
  if (title.startsWith("partner login and change-request")) return ["/partner/login", "/partner/companies/mock-partner-company-urban-gym", "/partner/companies/mock-partner-company-urban-gym/services/mock-partner-service-urban-gym-pt"];
  if (title.startsWith("legacy mm session")) return [];
  throw new Error("CI_E2E_ROUTE_PLAN_REQUIRED");
}
export function testInventory(report, { passed = false } = {}) {
  if (report?.errors?.length || !Array.isArray(report?.suites)) throw new Error("CI_E2E_REPORT_INVALID");
  const entries = [];
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (!spec.id || !spec.file || !spec.title || !["chromium", "admin-chromium"].includes(test.projectName)) throw new Error("CI_E2E_TEST_INVALID");
        if (passed && (test.results?.length !== 1 || test.results[0].status !== "passed" || test.results[0].retry !== 0 || test.results[0].error || test.results[0].errors?.length || test.expectedStatus !== "passed")) throw new Error("CI_E2E_RESULT_FAILED");
        entries.push({ id: `${spec.id}:${test.projectName}`, file: spec.file, title: spec.title });
      }
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  visit(report);
  if (!entries.length || new Set(entries.map((item) => item.id)).size !== entries.length) throw new Error("CI_E2E_INVENTORY_INVALID");
  return entries;
}
export function requireExactInventory(expected, actual) {
  const a = expected.map((item) => item.id).sort(); const b = actual.map((item) => item.id).sort();
  if (new Set(b).size !== b.length || JSON.stringify(a) !== JSON.stringify(b)) throw new Error("CI_E2E_COVERAGE_INVALID");
}
export function compilerPlan(inventory) {
  const routes = new Set(["/auth/login", "/api/e2e/mock/reset"]);
  let administrator = false;
  for (const item of inventory) {
    switch (item.file.split("/").at(-1)) {
      case "auth-ops.spec.ts": for (const route of authRoutes(item.title)) routes.add(route); break;
      case "graduate-verification.spec.ts": routes.add("/auth/signup/graduate"); break;
      case "home-partners.spec.ts": routes.add("/"); routes.add("/partners/health-001"); break;
      case "partner-detail-introduction.spec.ts": case "partner-image-carousel.spec.ts": routes.add("/partners/health-001"); break;
      case "partner-registration.spec.ts": routes.add("/partner-registration"); break;
      case "pwa-shell.spec.ts": routes.add("/"); break;
      case "admin-console.spec.ts": administrator = true; break;
      case "page-smoke.spec.ts": {
        if (/guards \/admin/u.test(item.title)) break;
        const route = /(?:renders|redirects) (\/[a-z0-9/-]*)$/u.exec(item.title)?.[1];
        if (!route) throw new Error("CI_E2E_ROUTE_PLAN_REQUIRED");
        routes.add(route); routes.add("/partner/login"); break;
      }
      default: throw new Error("CI_E2E_ROUTE_PLAN_REQUIRED");
    }
  }
  // Keep the common browser entry and first-test target freshly compiled;
  // long upfront preparation must not age them out of the dev entry cache.
  const tail = ["/api/e2e/mock/reset", "/auth/login", ...(inventory[0]?.title.startsWith("manual member setup") ? ["/auth/member/setup"] : [])];
  return { version: 1, routes: [...routes].filter((route) => !tail.includes(route)).concat(tail), administrator };
}
