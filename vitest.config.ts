import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));
const chromiumChannel =
  process.env.PLAYWRIGHT_CHROMIUM_CHANNEL === "chrome" ? "chrome" : undefined;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(dirname, "src"),
    },
  },
  optimizeDeps: {
    include: [
      "@supabase/supabase-js",
      "storybook/test",
      "next/cache",
      "next/headers",
      "nodemailer",
      "qrcode",
      "web-push",
    ],
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: path.join(dirname, ".tmp", "coverage", "unit"),
      include: [
        "src/components/partner-registration/registration-steps.ts",
        "src/lib/admin-dashboard-scope.ts",
        "src/lib/admin-ia.ts",
        "src/lib/admin-member-detail.ts",
        "src/lib/content-budget.ts",
        "src/lib/e2e-mutation-mode.ts",
        "src/lib/home-directory-state.ts",
        "src/lib/partner-billing-action-errors.ts",
        "src/lib/partner-portal-paths.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: [path.join(dirname, "tests", "unit", "**", "*.test.ts")],
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          setupFiles: [path.join(dirname, ".storybook", "vitest.setup.tsx")],
          browser: {
            enabled: true,
            headless: true,
            // Several interaction stories deliberately stub browser globals
            // such as fetch. Run files in one browser sequence so those test
            // doubles cannot leak into an unrelated story.
            fileParallelism: false,
            provider: playwright({
              launchOptions: chromiumChannel ? { channel: chromiumChannel } : {},
            }),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
