import base from "/work/playwright.config.ts";

// Keep the repository's complete suites, auth fixtures and 30-second test
// assertions. Only this constrained runner disables video encoding; screenshots
// and failure traces remain. Never change the GitHub/local default config here.
const config = {
  ...base,
  testDir: "/work/tests/e2e",
  outputDir: "/work/test-results",
  reporter: [["html", { outputFolder: "/work/playwright-report", open: "never" }], ["junit", { outputFile: "/work/playwright-results.xml" }], ["list"]],
  webServer: { ...base.webServer, cwd: "/work",
    // The builder's existing 3 GiB MemoryHigh also contains Docker and browser
    // processes. Bound only the dev compiler heap below that shared boundary.
    env: { ...base.webServer.env, NODE_OPTIONS: "--max-old-space-size=1536" } },
  retries: 0,
  maxFailures: 1,
  forbidOnly: true,
  use: { ...base.use, video: "off" },
  globalSetup: "/opt/ssartnership/warmup.mjs",
};
export default config;
