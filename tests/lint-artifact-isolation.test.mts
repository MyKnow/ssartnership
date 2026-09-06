import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";

test("lint excludes retained temporary QA/build artifacts but keeps tracked source checks", async () => {
  const eslint = new ESLint({ cwd: fileURLToPath(new URL("../", import.meta.url)) });
  assert.equal(await eslint.isPathIgnored(".tmp/self-host/retained-build/dev/server/page.js"), true);
  assert.equal(await eslint.isPathIgnored("scripts/self-host-ci/runner.mjs"), false);
  assert.equal(await eslint.isPathIgnored("src/app/layout.tsx"), false);
});
