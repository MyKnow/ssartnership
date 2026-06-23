import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function readRepoFile(pathname: string) {
  return readFileSync(new URL(`../${pathname}`, import.meta.url), "utf8");
}

test("public readiness CI workflow gates launch-critical checks", () => {
  const workflow = readRepoFile(".github/workflows/public-readiness.yml");

  for (const requiredText of [
    "name: Public Readiness",
    "pull_request:",
    "workflow_dispatch:",
    "node-version: 24",
    "npm ci",
    "npm run check:lockfile",
    "npm run validate:migrations",
    "npm run lint",
    "npx tsc --noEmit --pretty false",
    "npm test",
    "npm audit --omit=dev",
    "npm run audit:security",
    "npm run build",
    "PLAYWRIGHT_CHROMIUM_CHANNEL: chrome",
    "npm run test:e2e",
  ]) {
    assert.match(workflow, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("playwright config can use the CI-hosted Chrome channel", () => {
  const config = readRepoFile("playwright.config.ts");

  assert.match(config, /PLAYWRIGHT_CHROMIUM_CHANNEL/);
  assert.match(config, /channel: chromiumChannel/);
  assert.match(config, /video: chromiumChannel \? "off" : "retain-on-failure"/);
});

test("public repository exposes a responsible disclosure security policy", () => {
  const securityPolicy = readRepoFile("SECURITY.md");

  assert.match(securityPolicy, /SSARTNERSHIP Security Policy/);
  assert.match(securityPolicy, /myknow@ssafy\.com/);
  assert.match(securityPolicy, /public/i);
  assert.match(securityPolicy, /personal data/i);
});

test("public readiness TODO keeps the launch blocker remediation tracked", () => {
  const todo = readRepoFile("docs/product/todo.md");

  assert.match(todo, /공개 readiness 보완/);
  assert.match(todo, /Issue #55/);
  assert.match(todo, /SSAFY Verify Server API Production env/);
  assert.match(todo, /GitHub Actions 공개 readiness gate/);
});
