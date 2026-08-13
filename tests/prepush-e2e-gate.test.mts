import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pre-push gate mirrors Public Readiness before the full Playwright suite", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { scripts?: Record<string, string> };

  assert.equal(
    packageJson.scripts?.prepush,
    "npm run check:install-scripts && npm run check:lockfile && npm run validate:migrations && npm run lint && npm run typecheck:ci && npm test && npm run audit:security && npm run build && npm run test:e2e:ci",
  );
  assert.match(packageJson.scripts?.["test:e2e:ci"] ?? "", /CI=1/);
  assert.match(
    packageJson.scripts?.["test:e2e:ci"] ?? "",
    /PLAYWRIGHT_CHROMIUM_CHANNEL=chrome/,
  );
  assert.match(packageJson.scripts?.["test:e2e:ci"] ?? "", /playwright test/);

  const publicReadinessWorkflow = await readFile(
    new URL("../.github/workflows/public-readiness.yml", import.meta.url),
    "utf8",
  );
  assert.match(publicReadinessWorkflow, /run: npm run test:e2e:ci/);

  const releaseScript = await readFile(
    new URL("../scripts/release.sh", import.meta.url),
    "utf8",
  );
  assert.match(releaseScript, /npm run prepush/);

  const playwrightConfig = await readFile(
    new URL("../playwright.config.ts", import.meta.url),
    "utf8",
  );
  assert.match(playwrightConfig, /retries:\s*0/);
  assert.doesNotMatch(playwrightConfig, /retries:\s*process\.env\.CI/);
  assert.match(playwrightConfig, /trace:\s*"retain-on-failure"/);
  assert.match(playwrightConfig, /non-loopback BASE_URL requires an explicit/);
  assert.match(playwrightConfig, /hostname === "127\.0\.0\.1"/);
  assert.match(playwrightConfig, /NEXT_DIST_DIR: "\.next-e2e"/);
  assert.match(playwrightConfig, /PARTNER_SESSION_SECRET:/);

  const eslintConfig = await readFile(
    new URL("../eslint.config.mjs", import.meta.url),
    "utf8",
  );
  assert.match(eslintConfig, /"\.next-e2e\/\*\*"/);

  const adminConsoleSpec = await readFile(
    new URL("./e2e/admin-console.spec.ts", import.meta.url),
    "utf8",
  );
  assert.match(adminConsoleSpec, /async function settleLateAdminRequests\(page: Page\)/);
  assert.equal(
    adminConsoleSpec.match(/await settleLateAdminRequests\(page\);/g)?.length,
    2,
  );
  assert.doesNotMatch(adminConsoleSpec, /test\.afterEach/);
  assert.doesNotMatch(adminConsoleSpec, /activeRequestsByPage/);
});
