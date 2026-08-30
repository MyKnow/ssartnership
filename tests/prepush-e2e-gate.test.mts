import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("change-aware prepush stays tiered while promotion gates own browser coverage", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { scripts?: Record<string, string> };

  assert.equal(packageJson.scripts?.prepush, "npm run verify:change");
  assert.equal(
    packageJson.scripts?.["verify:change"],
    "node scripts/verify-change.mjs",
  );
  assert.equal(
    packageJson.scripts?.["verify:quick"],
    "node scripts/run-package-scripts.mjs check:install-scripts check:cross-platform check:lockfile validate:migrations lint typecheck:ci test audit:security",
  );
  assert.equal(
    packageJson.scripts?.["verify:release"],
    "node scripts/run-package-scripts.mjs verify:quick verify:release:post-quick",
  );
  assert.equal(
    packageJson.scripts?.["verify:release:post-quick"],
    "node scripts/run-package-scripts.mjs build test:e2e:ci",
  );
  assert.equal(
    packageJson.scripts?.["test:e2e:ci"],
    "node scripts/run-e2e-ci.mjs",
  );
  assert.equal(
    packageJson.scripts?.["test:e2e:smoke:ci"],
    "node scripts/run-e2e-ci.mjs --grep @critical",
  );
  assert.equal(
    packageJson.scripts?.["verify:promotion:smoke"],
    "node scripts/run-package-scripts.mjs build test:e2e:smoke:ci",
  );

  const typecheckRunner = await readFile(
    new URL("../scripts/typecheck-ci.mjs", import.meta.url),
    "utf8",
  );
  const typecheckConfig = JSON.parse(
    await readFile(new URL("../tsconfig.typecheck.json", import.meta.url), "utf8"),
  ) as { include?: string[]; exclude?: string[] };
  assert.match(typecheckRunner, /tsconfig\.typecheck\.json/);
  assert.deepEqual(typecheckConfig.include, ["**/*.ts", "**/*.tsx", "**/*.mts"]);
  assert.deepEqual(typecheckConfig.exclude, [
    "node_modules",
    ".next",
    ".next-e2e",
    "next-env.d.ts",
  ]);

  const e2eRunner = await readFile(
    new URL("../scripts/run-e2e-ci.mjs", import.meta.url),
    "utf8",
  );
  assert.match(e2eRunner, /CI: "1"/);
  assert.match(e2eRunner, /PLAYWRIGHT_CHROMIUM_CHANNEL: "chrome"/);
  assert.match(e2eRunner, /delete childEnvironment\.NO_COLOR/);
  assert.match(e2eRunner, /playwrightCli, "test"/);

  const publicReadinessWorkflow = await readFile(
    new URL("../.github/workflows/public-readiness.yml", import.meta.url),
    "utf8",
  );
  assert.match(publicReadinessWorkflow, /name: Classify Change/);
  assert.match(publicReadinessWorkflow, /name: Change-Aware Verification/);
  assert.match(publicReadinessWorkflow, /name: CI Policy Gate/);
  assert.match(publicReadinessWorkflow, /if: \$\{\{ always\(\) \}\}/);
  assert.match(publicReadinessWorkflow, /run: node scripts\/ci-policy-gate\.mjs/);
  assert.match(
    publicReadinessWorkflow,
    /run: npm run verify:release:post-quick/,
  );
  assert.match(
    publicReadinessWorkflow,
    /run: npm run verify:promotion:smoke/,
  );

  const pageSmoke = await readFile(
    new URL("./e2e/page-smoke.spec.ts", import.meta.url),
    "utf8",
  );
  const authOperations = await readFile(
    new URL("./e2e/auth-ops.spec.ts", import.meta.url),
    "utf8",
  );
  const adminConsole = await readFile(
    new URL("./e2e/admin-console.spec.ts", import.meta.url),
    "utf8",
  );
  const partnerRegistration = await readFile(
    new URL("./e2e/partner-registration.spec.ts", import.meta.url),
    "utf8",
  );
  for (const criticalPath of [
    "/",
    "/auth/login",
    "/partners/health-001",
    "/certification",
    "/partner",
    "/admin/login",
    "/admin",
  ]) {
    assert.match(pageSmoke, new RegExp(`"${criticalPath.replaceAll("/", "\\/")}"`));
  }
  assert.match(authOperations, /@critical member login/);
  assert.match(adminConsole, /@critical renders the admin home/);
  assert.match(partnerRegistration, /@critical partner registration/);

  const releaseScript = await readFile(
    new URL("../scripts/release.mjs", import.meta.url),
    "utf8",
  );
  assert.match(releaseScript, /runRequiredScript\("prepush"\)/);
  assert.match(releaseScript, /ensureVersionFilesDoNotHaveUnstagedChanges/);
  assert.match(releaseScript, /stageReleaseVersionFiles/);
  assert.doesNotMatch(releaseScript, /runGit\(\["add", "-A"\]\)/);
  assert.match(
    releaseScript,
    /runGit\(\["add", "--", "package\.json", "package-lock\.json"\]\)/,
  );
  assert.doesNotMatch(releaseScript, /runRequiredScript\("build-storybook"\)/);
  assert.doesNotMatch(releaseScript, /runRequiredScript\("test-storybook"\)/);
  assert.doesNotMatch(releaseScript, /runRequiredScript\("test:visual"\)/);

  const playwrightConfig = await readFile(
    new URL("../playwright.config.ts", import.meta.url),
    "utf8",
  );
  assert.match(playwrightConfig, /retries:\s*0/);
  assert.doesNotMatch(playwrightConfig, /retries:\s*process\.env\.CI/);
  assert.match(playwrightConfig, /trace:\s*"retain-on-failure"/);
  assert.match(playwrightConfig, /non-loopback BASE_URL requires an explicit/);
  assert.match(playwrightConfig, /hostname === "127\.0\.0\.1"/);
  assert.match(playwrightConfig, /const nodeExecutable =/);
  assert.match(playwrightConfig, /process\.execPath/);
  assert.doesNotMatch(playwrightConfig, /command: `npm run dev/);
  assert.match(playwrightConfig, /NEXT_DIST_DIR: "\.next-e2e"/);
  assert.match(playwrightConfig, /PARTNER_SESSION_SECRET:/);
  assert.match(playwrightConfig, /retries: 0/);
  assert.match(playwrightConfig, /trace: "retain-on-failure"/);

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
      smokeHelper.indexOf('await page.waitForLoadState("load")'),
  );
  assert.ok(
    redirectHelper.indexOf("await expectNoNextError(page)") <
      redirectHelper.indexOf('await page.waitForLoadState("load")'),
  );
  assert.doesNotMatch(pageSmokeSpec, /waitForLoadState\("networkidle"/);
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
    /await (?:gotoDirectory\(page, "\/"\)|waitForDirectoryControls\(page\))/,
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
  assert.doesNotMatch(
    publicPartnerNavigationTest,
    /page\.waitForLoadState\("networkidle"\)/,
  );
  assert.doesNotMatch(
    publicPartnerNavigationTest,
    /force:\s*true|waitForTimeout|retry/,
  );
});

test("Mattermost signup E2E waits for its finite form readiness instead of global network idle", async () => {
  const authOperations = await readFile(
    new URL("./e2e/auth-ops.spec.ts", import.meta.url),
    "utf8",
  );
  const mattermostSignupTest = authOperations.match(
    /test\("Mattermost 가입 인증은 5분 타이머를 표시하고 기존 회원은 로그인으로 안내한다",[\s\S]*?\n  \}\);/,
  )?.[0];

  assert.ok(mattermostSignupTest);
  assert.match(
    mattermostSignupTest,
    /await page\.goto\("\/auth\/signup"\);[\s\S]*?await expect\(generationOption\)\.toBeAttached\(\);/,
  );
  assert.doesNotMatch(
    mattermostSignupTest,
    /waitForLoadState\("networkidle"\)|waitForTimeout|test\.slow|test\.setTimeout|\bretries?\b/,
  );
});
