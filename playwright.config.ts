import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.E2E_PORT ?? "3100";
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${e2ePort}`;
const adminBaseURL = process.env.BASE_URL ?? `http://localhost:${e2ePort}`;
const chromiumChannel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL === "chrome" ? "chrome" : undefined;
const isLoopbackBaseURL = (() => {
  try {
    const hostname = new URL(baseURL).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  } catch {
    return false;
  }
})();
if (!isLoopbackBaseURL && !process.env.E2E_ADMIN_GATEWAY_PASSWORD) {
  throw new Error(
    "A non-loopback BASE_URL requires an explicit E2E_ADMIN_GATEWAY_PASSWORD.",
  );
}
const e2eAdminGatewayPassword =
  process.env.E2E_ADMIN_GATEWAY_PASSWORD ?? ["e2e", "admin", "gateway", "password"].join("-");
const e2eAdminGatewayCredentials = {
  username: process.env.E2E_ADMIN_GATEWAY_USERNAME ?? "e2e-admin-gateway",
  password: e2eAdminGatewayPassword,
};
const e2eAdminAuthorization = `Basic ${Buffer.from(
  `${e2eAdminGatewayCredentials.username}:${e2eAdminGatewayCredentials.password}`,
).toString("base64")}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // Required CI must fail on the first test failure. A retry can turn a real
  // regression into a misleading green GitHub check.
  retries: 0,
  workers: 1,
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "playwright-results.xml" }],
    ["list"],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: chromiumChannel ? "off" : "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumChannel ? { channel: chromiumChannel } : {}),
      },
      testIgnore: /admin-console\.spec\.ts/,
    },
    {
      name: "admin-chromium",
      testMatch: /admin-console\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: adminBaseURL,
        ...(chromiumChannel ? { channel: chromiumChannel } : {}),
        httpCredentials: e2eAdminGatewayCredentials,
        extraHTTPHeaders: {
          Authorization: e2eAdminAuthorization,
        },
      },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${e2ePort} --webpack`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          E2E_MOCK_MUTATIONS: "1",
          NEXT_DIST_DIR: ".next-e2e",
          NEXT_PUBLIC_DATA_SOURCE: "mock",
          E2E_ADMIN_AUTH: "1",
          ADMIN_BASIC_AUTH_USERNAME: e2eAdminGatewayCredentials.username,
          ADMIN_BASIC_AUTH_PASSWORD: e2eAdminGatewayCredentials.password,
          ADMIN_SESSION_SECRET: "e2e-admin-session-secret-at-least-32-chars",
          USER_SESSION_SECRET: "e2e-user-session-secret-at-least-32-chars",
          MOCK_MEMBER_AUTH: "1",
          MOCK_ID: "myknow",
          MOCK_PW: "e2e-member-password",
          NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "mock",
          PARTNER_SESSION_SECRET: "e2e-partner-session-secret-for-playwright-only",
        },
      },
});
