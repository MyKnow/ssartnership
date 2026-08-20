import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pre-push gate verifies the canonical lockfile before the full Playwright suite", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { scripts?: Record<string, string> };

  assert.equal(
    packageJson.scripts?.prepush,
    "node scripts/run-package-scripts.mjs check:install-scripts check:cross-platform check:lockfile test:e2e:ci",
  );
  assert.equal(
    packageJson.scripts?.["test:e2e:ci"],
    "node scripts/run-e2e-ci.mjs",
  );

  const e2eRunner = await readFile(
    new URL("../scripts/run-e2e-ci.mjs", import.meta.url),
    "utf8",
  );
  assert.match(e2eRunner, /CI: "1"/);
  assert.match(e2eRunner, /PLAYWRIGHT_CHROMIUM_CHANNEL: "chrome"/);
  assert.match(e2eRunner, /delete childEnvironment\.NO_COLOR/);
  assert.match(e2eRunner, /playwrightCli, "test"/);

  const publicReadinessWorkflow = await readFile(
    new URL("../.github/workflows/public-readiness.yml", import.meta.url),
    "utf8",
  );
  assert.match(publicReadinessWorkflow, /run: npm run test:e2e:ci/);

  const releaseScript = await readFile(
    new URL("../scripts/release.mjs", import.meta.url),
    "utf8",
  );
  assert.match(releaseScript, /runRequiredScript\("prepush"\)/);

  const playwrightConfig = await readFile(
    new URL("../playwright.config.ts", import.meta.url),
    "utf8",
  );
  assert.match(playwrightConfig, /NEXT_DIST_DIR: "\.next-e2e"/);
  assert.match(playwrightConfig, /PARTNER_SESSION_SECRET:/);
  assert.match(playwrightConfig, /retries: 0/);
  assert.match(playwrightConfig, /trace: "retain-on-failure"/);

  const eslintConfig = await readFile(
    new URL("../eslint.config.mjs", import.meta.url),
    "utf8",
  );
  assert.match(eslintConfig, /"\.next-e2e\/\*\*"/);
});
