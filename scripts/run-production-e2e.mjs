import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { assertNoFixtureDotenv, FIXTURE_DIST } from "./webpack-fixture-boundary.mjs";

// Synthetic production fixtures have a separate output and can never be deployed.
assertNoFixtureDotenv(process.cwd());
const directory = resolve(process.cwd(), FIXTURE_DIST);
if (existsSync(directory)) {
  if (lstatSync(directory).isSymbolicLink()) throw new Error("E2E_FIXTURE_SYMLINK_REJECTED");
  rmSync(directory, { recursive: true });
}
const environment = { ...process.env, CI: "1", PLAYWRIGHT_CHROMIUM_CHANNEL: "chrome" };
delete environment.NO_COLOR;
for (const args of [
  ["scripts/self-host-ci/build-production-e2e.mjs"],
  ["node_modules/@playwright/test/cli.js", "test", "--config", "deploy/self-host-ci/playwright.production.config.ts", ...process.argv.slice(2)],
]) {
  const result = spawnSync(process.execPath, args, { env: environment, stdio: "inherit" });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
