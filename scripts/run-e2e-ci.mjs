#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { repositoryRoot } from "./lib/development-environment.mjs";

const playwrightCli = fileURLToPath(
  new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
);
const childEnvironment = {
  ...process.env,
  CI: "1",
  PLAYWRIGHT_CHROMIUM_CHANNEL: "chrome",
};
delete childEnvironment.NO_COLOR;

const result = spawnSync(
  process.execPath,
  [playwrightCli, "test", ...process.argv.slice(2)],
  {
    cwd: repositoryRoot,
    env: childEnvironment,
    stdio: "inherit",
  },
);

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
}
process.exit(result.status ?? 1);
