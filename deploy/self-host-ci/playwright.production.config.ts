import base from "../../playwright.config.ts";
import { fileURLToPath } from "node:url";
import type { PlaywrightTestConfig } from "@playwright/test";
import { productionFixtureEnvironment } from "../../scripts/self-host-ci/production-e2e-profile.mjs";

if (process.env.BASE_URL || !base.webServer || Array.isArray(base.webServer)) {
  throw new Error("E2E_FIXTURE_LOOPBACK_REQUIRED");
}
const port = process.env.E2E_PORT ?? "3100";
const root = fileURLToPath(new URL("../..", import.meta.url));
const config: PlaywrightTestConfig = {
  ...base,
  testDir: fileURLToPath(new URL("../../tests/e2e", import.meta.url)),
  outputDir: fileURLToPath(new URL("../../.tmp/self-host/production-e2e/test-results", import.meta.url)),
  reporter: [["json", { outputFile: fileURLToPath(new URL("../../.tmp/self-host/production-e2e/results.json", import.meta.url)) }], ["list"]],
  webServer: {
    ...base.webServer,
    cwd: root,
    command: `${JSON.stringify(process.execPath)} scripts/self-host-ci/start-production-e2e.mjs ${port}`,
    env: productionFixtureEnvironment(base.webServer.env, port),
  },
};
export default config;
