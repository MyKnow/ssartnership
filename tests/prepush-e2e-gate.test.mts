import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pre-push gate mirrors Public Readiness before the full Playwright suite", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { scripts?: Record<string, string> };

  assert.equal(
    packageJson.scripts?.prepush,
    "npm run check:install-scripts && npm run check:lockfile && npm run validate:migrations && npm run lint && npm run typecheck:ci && npm test && npm run audit:security && npm run build && npm run test:e2e:ci",
  );
  assert.match(packageJson.scripts?.["test:e2e:ci"] ?? "", /CI=1/);
  assert.match(
    packageJson.scripts?.["test:e2e:ci"] ?? "",
    /PLAYWRIGHT_CHROMIUM_CHANNEL=chrome/,
  );
  assert.match(packageJson.scripts?.["test:e2e:ci"] ?? "", /playwright test/);

  const publicReadinessWorkflow = await readFile(
    new URL("../.github/workflows/public-readiness.yml", import.meta.url),
    "utf8",
  );
  assert.match(publicReadinessWorkflow, /run: npm run test:e2e:ci/);

  const releaseScript = await readFile(
    new URL("../scripts/release.sh", import.meta.url),
    "utf8",
  );
  assert.match(releaseScript, /npm run prepush/);

  const playwrightConfig = await readFile(
    new URL("../playwright.config.ts", import.meta.url),
    "utf8",
  );
  assert.match(playwrightConfig, /retries:\s*0/);
  assert.doesNotMatch(playwrightConfig, /retries:\s*process\.env\.CI/);
  assert.match(playwrightConfig, /trace:\s*"retain-on-failure"/);
  assert.match(playwrightConfig, /non-loopback BASE_URL requires an explicit/);
  assert.match(playwrightConfig, /hostname === "127\.0\.0\.1"/);
  assert.match(playwrightConfig, /NEXT_DIST_DIR: "\.next-e2e"/);
  assert.match(playwrightConfig, /PARTNER_SESSION_SECRET:/);

  const eslintConfig = await readFile(
    new URL("../eslint.config.mjs", import.meta.url),
    "utf8",
  );
  assert.match(eslintConfig, /"\.next-e2e\/\*\*"/);

  const adminConsoleSpec = await readFile(
    new URL("./e2e/admin-console.spec.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    adminConsoleSpec,
    /async function waitForAdminShellHydration\(page: Page\)/,
  );
  assert.match(adminConsoleSpec, /\[data-admin-hydrated="true"\]/);
  assert.doesNotMatch(adminConsoleSpec, /waitForLoadState\("networkidle"/);
  assert.doesNotMatch(adminConsoleSpec, /test\.afterEach/);
  assert.doesNotMatch(adminConsoleSpec, /activeRequestsByPage/);
  const openAdminRouteHelper = adminConsoleSpec.match(
    /async function openAdminRoute[\s\S]*?\n}/,
  )?.[0];
  assert.ok(openAdminRouteHelper);
  assert.ok(
    openAdminRouteHelper.indexOf("await page.goto") <
      openAdminRouteHelper.indexOf("await waitForAdminShellHydration"),
  );

  const responsiveTest = adminConsoleSpec.match(
    /test\("keeps the registration queue inside narrow and wide viewports",[\s\S]*?\n  \}\);/,
  )?.[0];
  assert.ok(responsiveTest);
  assert.equal(responsiveTest.match(/openAdminRoute\(/g)?.length, 1);
  assert.match(
    responsiveTest,
    /openAdminRoute\(page, "\/admin\/partner-registrations"\)/,
  );
  assert.doesNotMatch(responsiveTest, /page\.reload\(|\.click\(/);
  assert.ok(
    responsiveTest.indexOf('openAdminRoute(page, "/admin/partner-registrations")') <
      responsiveTest.indexOf("for (const width"),
  );

  const adminShellView = await readFile(
    new URL("../src/components/admin/AdminShellView.tsx", import.meta.url),
    "utf8",
  );
  assert.match(adminShellView, /const hydrated = useHydrated\(\)/);
  assert.match(adminShellView, /data-admin-hydrated=\{hydrated\}/);

  const pageSmokeSpec = await readFile(
    new URL("./e2e/page-smoke.spec.ts", import.meta.url),
    "utf8",
  );
  const smokeHelper = pageSmokeSpec.match(
    /async function visitSmokeRoute[\s\S]*?\n}/,
  )?.[0];
  const redirectHelper = pageSmokeSpec.match(
    /async function visitRedirectRoute[\s\S]*?\n}/,
  )?.[0];

  assert.ok(smokeHelper);
  assert.ok(redirectHelper);
  assert.ok(
    smokeHelper.indexOf("await expectNoNextError(page)") <
      smokeHelper.indexOf('await page.waitForLoadState("networkidle")'),
  );
  assert.ok(
    redirectHelper.indexOf("await expectNoNextError(page)") <
      redirectHelper.indexOf('await page.waitForLoadState("networkidle")'),
  );
  assert.doesNotMatch(pageSmokeSpec, /test\.afterEach/);

  const pwaProvider = await readFile(
    new URL("../src/components/PwaProvider.tsx", import.meta.url),
    "utf8",
  );
  assert.match(pwaProvider, /process\.env\.NODE_ENV !== "production"/);
  assert.match(
    pwaProvider,
    /process\.env\.NEXT_PUBLIC_DATA_SOURCE === "mock"/,
  );
  assert.ok(
    pwaProvider.indexOf('process.env.NODE_ENV !== "production"') <
      pwaProvider.indexOf('navigator.serviceWorker.register("/sw.js")'),
  );

  const homePartnersSpec = await readFile(
    new URL("./e2e/home-partners.spec.ts", import.meta.url),
    "utf8",
  );
  const publicPartnerNavigationTest = homePartnersSpec.match(
    /test\("lists partners and opens a public partner detail page",[\s\S]*?\n  \}\);/,
  )?.[0];
  assert.ok(publicPartnerNavigationTest);
  assert.match(
    publicPartnerNavigationTest,
    /await waitForDirectoryControls\(page\)/,
  );
  assert.match(publicPartnerNavigationTest, /await Promise\.all\(\[/);
  assert.match(
    publicPartnerNavigationTest,
    /page\.waitForURL\([\s\S]*timeout: 15_000/,
  );
  assert.ok(
    publicPartnerNavigationTest.indexOf("page.waitForURL") <
      publicPartnerNavigationTest.indexOf("publicPartnerLink.click"),
  );
  assert.ok(
    publicPartnerNavigationTest.lastIndexOf('page.waitForLoadState("networkidle")') >
      publicPartnerNavigationTest.lastIndexOf('getByRole("heading"'),
  );
  assert.doesNotMatch(
    publicPartnerNavigationTest,
    /force:\s*true|waitForTimeout|retry/,
  );
});
