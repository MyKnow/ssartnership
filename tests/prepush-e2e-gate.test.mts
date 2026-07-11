import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pre-push gate runs the full Playwright suite with CI parity", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { scripts?: Record<string, string> };

  assert.equal(packageJson.scripts?.prepush, "npm run test:e2e:ci");
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
  assert.match(playwrightConfig, /NEXT_DIST_DIR: "\.next-e2e"/);
});
