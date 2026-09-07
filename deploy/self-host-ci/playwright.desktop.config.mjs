import base from "/work/playwright.config.ts";

// The Mac's larger, explicitly approved container uses the ordinary complete
// suite lifecycle. No preparatory page requests or native-server sharding.
const config = {
  ...base,
  testDir: "/work/tests/e2e",
  outputDir: "/work/.self-host-build/e2e/desktop/test-results",
  reporter: [["json", { outputFile: "/work/.self-host-build/e2e/desktop/results.json" }], ["list"]],
  webServer: { ...base.webServer, cwd: "/work", stdout: "pipe",
    env: { ...base.webServer.env, SELF_HOST_ATOMIC_MANIFESTS: "1", NODE_OPTIONS: "--max-old-space-size=3072" } },
  retries: 0,
  maxFailures: 1,
  forbidOnly: true,
  use: { ...base.use, video: "off", trace: { mode: "retain-on-failure", screenshots: false, snapshots: true, sources: true } },
};
export default config;
