import { defineConfig } from "@playwright/test";

const port = process.env.STORYBOOK_VISUAL_PORT ?? "6007";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: [["list"]],
  snapshotPathTemplate: "{testDir}/__snapshots__/{arg}{ext}",
  use: {
    baseURL,
    browserName: "chromium",
    colorScheme: "light",
    locale: "ko-KR",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: `npx storybook dev --ci --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
