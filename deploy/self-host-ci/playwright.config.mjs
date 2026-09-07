import base from "/work/playwright.config.ts";
import { parseBatch } from "./batch-plan.mjs";
const batch = parseBatch(process.env.SELF_HOST_CI_E2E_BATCH ?? "0", true);
const reportDirectory = `/work/.self-host-build/e2e/batch-${batch}`;

// Keep the repository's complete suites, auth fixtures and 30-second test
// assertions. Only this constrained runner disables video encoding; screenshots
// and failure traces remain. Never change the GitHub/local default config here.
const config = {
  ...base,
  testDir: "/work/tests/e2e",
  outputDir: `${reportDirectory}/test-results`,
  reporter: [["html", { outputFolder: `${reportDirectory}/html`, open: "never" }], ["json", { outputFile: `${reportDirectory}/results.json` }], ["junit", { outputFile: `${reportDirectory}/results.xml` }], ["list"]],
  webServer: { ...base.webServer, cwd: "/work",
    url: "http://127.0.0.1:3100/api/health",
    stdout: "pipe",
    // Disable Node's dev stack-map cache, not browser traces/screenshots or
    // any application behavior. Keep the constrained compiler below the slice.
    command: `${base.webServer.command} --disable-source-maps`,
    // The builder's existing 3 GiB MemoryHigh also contains Docker and browser
    // processes. Bound only the dev compiler heap below that shared boundary.
    env: { ...base.webServer.env, SELF_HOST_ATOMIC_MANIFESTS: "1", NODE_OPTIONS: "--max-old-space-size=2048" } },
  retries: 0,
  maxFailures: 1,
  forbidOnly: true,
  use: { ...base.use, video: "off",
    // Avoid continuous JPEG screencasting on the shared 1.5-CPU builder.
    // Keep failure screenshots plus DOM, network, source and action traces.
    trace: { mode: "retain-on-failure", screenshots: false, snapshots: true, sources: true } },
  globalSetup: "/opt/ssartnership/warmup.mjs",
};
export default config;
