import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

function readRepoFile(pathname: string) {
  return readFileSync(new URL(`../${pathname}`, import.meta.url), "utf8");
}

const WORKFLOW_FILES = [
  "admin-performance.yml",
  "preview-migrations.yml",
  "preview-sync.yml",
  "production-migrations.yml",
  "public-readiness.yml",
  "storybook.yml",
] as const;

const VERIFIED_SUPABASE_CLI_VERSION = "2.114.0";

test("GitHub Actions use the Node 24 action runtime and project runtime with read-only repository access", () => {
  for (const filename of WORKFLOW_FILES) {
    const workflow = readRepoFile(`.github/workflows/${filename}`);
    const checkoutVersions = [
      ...workflow.matchAll(/actions\/checkout@(v\d+(?:\.\d+)*)/g),
    ].map((match) => match[1]);
    const setupNodeVersions = [
      ...workflow.matchAll(/actions\/setup-node@(v\d+(?:\.\d+)*)/g),
    ].map((match) => match[1]);
    const projectNodeVersions = [
      ...workflow.matchAll(/node-version:\s*["']?([^\s"'#]+)["']?/g),
    ].map((match) => match[1]);

    assert.ok(checkoutVersions.length > 0, `${filename}: checkout action missing`);
    assert.deepEqual(
      new Set(checkoutVersions),
      new Set(["v7"]),
      `${filename}: checkout must use the Node 24 runtime release`,
    );
    assert.ok(setupNodeVersions.length > 0, `${filename}: setup-node action missing`);
    assert.deepEqual(
      new Set(setupNodeVersions),
      new Set(["v7"]),
      `${filename}: setup-node must use the Node 24 runtime release`,
    );
    assert.equal(
      projectNodeVersions.length,
      setupNodeVersions.length,
      `${filename}: every setup-node step must declare the project Node version`,
    );
    assert.deepEqual(
      new Set(projectNodeVersions),
      new Set(["24.18.1"]),
      `${filename}: project commands must run on the pinned Node release`,
    );
    assert.match(
      workflow,
      /permissions:\s*\n\s+contents: read/,
      `${filename}: repository token must remain read-only`,
    );
  }
});

test("public readiness classifies the diff and closes conditional jobs with one policy gate", () => {
  const workflow = readRepoFile(".github/workflows/public-readiness.yml");

  for (const requiredText of [
    "name: Public Readiness",
    "pull_request:",
    "workflow_dispatch:",
    "node-version: 24.18.1",
    "npm run install:trusted",
    "name: Classify Change",
    "node scripts/change-policy.mjs",
    "name: Change-Aware Verification",
    "npm run verify:change",
    "name: CI Policy Gate",
    "node scripts/ci-policy-gate.mjs",
    "verify_step_result: ${{ steps.change-verify.outcome }}",
    "VERIFY_STEP_RESULT: ${{ needs.verify.outputs.verify_step_result }}",
    "PLAYWRIGHT_CHROMIUM_CHANNEL: chrome",
    "npm run verify:promotion:smoke",
    "npm run verify:release:post-quick",
  ]) {
    assert.match(
      workflow,
      new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }

  assert.match(workflow, /push:\s*\n\s+branches:\s*\[main, dev\]/);
  assert.match(workflow, /pull_request:\s*\n\s+branches:\s*\[main, dev\]/);
  assert.match(workflow, /concurrency:\s*\n\s+group:/);
  assert.match(workflow, /cancel-in-progress:\s+true/);
  assert.match(workflow, /contains\(github\.event\.pull_request\.labels\.\*\.name, 'ci:full'\)/);
  assert.match(workflow, /if:\s*\$\{\{ always\(\) \}\}/);
  assert.match(workflow, /needs:\s*\[classify, verify\]/);
  assert.match(workflow, /fetch-depth:\s*0/);
  assert.doesNotMatch(workflow, /name: Dependency audit/);
  assert.doesNotMatch(workflow, /run: npm audit --omit=dev/);
  assert.match(workflow, /persist-credentials:\s+false/);
  assert.doesNotMatch(workflow, /\bnpm (?:ci|install)\b/);
  assert.doesNotMatch(
    workflow,
    /if:\s*\$\{\{\s*github\.event_name != 'pull_request' \|\| !github\.event\.pull_request\.draft\s*\}\}/,
  );
});

test("local prepush shares the change classifier while explicit promotion gates stay available", () => {
  const packageJson = JSON.parse(readRepoFile("package.json")) as {
    scripts: Record<string, string>;
  };
  const quick = packageJson.scripts["verify:quick"];

  for (const requiredScript of [
    "check:install-scripts",
    "check:cross-platform",
    "check:lockfile",
    "validate:migrations",
    "lint",
    "typecheck:ci",
    "test",
    "audit:security",
  ]) {
    assert.match(
      quick,
      new RegExp(requiredScript.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.equal(packageJson.scripts.prepush, "npm run verify:change");
  assert.equal(
    packageJson.scripts["classify:change"],
    "node scripts/change-policy.mjs",
  );
  assert.equal(
    packageJson.scripts["verify:change"],
    "node scripts/verify-change.mjs",
  );
  assert.equal(packageJson.scripts["check:docs"], "node scripts/check-docs.mjs");
  assert.match(readRepoFile("scripts/verify-change.mjs"), /runRequired\("check:docs"\)/);
  assert.doesNotMatch(quick, /\bbuild\b|test:e2e:ci/);
  assert.match(
    packageJson.scripts["verify:release"],
    /verify:quick verify:release:post-quick/,
  );
  assert.match(
    packageJson.scripts["verify:release:post-quick"],
    /build test:e2e:ci/,
  );
  assert.match(
    packageJson.scripts["verify:promotion:smoke"],
    /build test:e2e:smoke:ci/,
  );
  assert.match(packageJson.scripts["test:e2e:smoke:ci"], /--grep @critical/);

  const release = readRepoFile("scripts/release.mjs");
  assert.match(release, /runRequiredScript\("prepush"\)/);
  assert.match(release, /ensureVersionFilesDoNotHaveUnstagedChanges/);
  assert.match(release, /stageReleaseVersionFiles/);
  assert.doesNotMatch(release, /runGit\(\["add", "-A"\]\)/);
  assert.match(
    release,
    /runGit\(\["add", "--", "package\.json", "package-lock\.json"\]\)/,
  );
  assert.doesNotMatch(release, /runRequiredScript\("build-storybook"\)/);
  assert.doesNotMatch(release, /runRequiredScript\("test-storybook"\)/);
  assert.doesNotMatch(release, /runRequiredScript\("test:visual"\)/);
});

test("auth E2E mock reset waits for a semantic application readiness boundary", () => {
  const authOperations = readRepoFile("tests/e2e/auth-ops.spec.ts");
  const readinessIndex = authOperations.indexOf('await page.goto("/auth/login");');
  const resetIndex = authOperations.indexOf('page.request.post("/api/e2e/mock/reset")');

  assert.ok(readinessIndex >= 0, "auth operations must warm the login route first");
  assert.ok(resetIndex > readinessIndex, "mock reset must follow route readiness");
  assert.match(
    authOperations,
    /getByRole\("textbox", \{ name: "아이디 또는 이메일" \}\)[\s\S]*?\.toBeVisible\(\);[\s\S]*?page\.request\.post\("\/api\/e2e\/mock\/reset"\)/,
  );
});

test("active workflows use the current Node 24 GitHub action majors", () => {
  const workflowsDirectory = new URL("../.github/workflows/", import.meta.url);
  const workflowNames = readdirSync(workflowsDirectory)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort();
  let actionCount = 0;

  for (const workflowName of workflowNames) {
    const workflow = readFileSync(new URL(workflowName, workflowsDirectory), "utf8");
    const actions = workflow.matchAll(
      /uses:\s*actions\/(checkout|setup-node)@([^\s#]+)/g,
    );

    for (const action of actions) {
      actionCount += 1;
      assert.equal(
        action[2],
        "v7",
        `${workflowName} must use actions/${action[1]}@v7`,
      );
    }
  }

  assert.ok(actionCount > 0, "expected active workflows to use GitHub Node actions");
});

test("active Supabase workflows pin the Production-validated CLI version", () => {
  const workflowsDirectory = new URL("../.github/workflows/", import.meta.url);
  const workflowNames = readdirSync(workflowsDirectory)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort();
  let setupCliStepCount = 0;

  for (const workflowName of workflowNames) {
    const workflow = readFileSync(new URL(workflowName, workflowsDirectory), "utf8");
    const lines = workflow.split("\n");

    assert.doesNotMatch(
      workflow,
      /^\s*version:\s*["']?latest["']?(?:\s+#.*)?$/m,
      `${workflowName}: active workflows must not float a CLI version`,
    );

    for (let index = 0; index < lines.length; index += 1) {
      const setupCliUse = lines[index].match(
        /^(\s*)uses:\s*supabase\/setup-cli@v2\s*$/,
      );
      if (!setupCliUse) {
        continue;
      }

      setupCliStepCount += 1;
      const usesIndent = setupCliUse[1].length;
      let configuredVersion: string | null = null;

      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const line = lines[cursor];
        const trimmedLine = line.trimStart();
        const lineIndent = line.length - trimmedLine.length;

        if (trimmedLine.startsWith("- ") && lineIndent < usesIndent) {
          break;
        }

        const version = line.match(
          /^\s+version:\s*["']?([^\s"'#]+)["']?(?:\s+#.*)?$/,
        );
        if (version) {
          configuredVersion = version[1];
          break;
        }
      }

      assert.equal(
        configuredVersion,
        VERIFIED_SUPABASE_CLI_VERSION,
        `${workflowName}: supabase/setup-cli must use the Production-validated version`,
      );
    }
  }

  assert.ok(
    setupCliStepCount > 0,
    "expected at least one active Supabase setup-cli step",
  );
});

test("Storybook interaction and visual baselines are explicit manual tools", () => {
  const workflow = readRepoFile(".github/workflows/storybook.yml");
  const preview = readRepoFile(".storybook/preview.tsx");
  const vitestConfig = readRepoFile("vitest.config.ts");
  const manualMemberImportStories = readRepoFile(
    "src/components/admin/AdminMemberManualAddPanel.stories.tsx",
  );
  const imageUploadDraftClient = readRepoFile("src/lib/image-upload/draft.client.ts");

  assert.match(workflow, /name: Storybook and Visual Baselines/);
  assert.doesNotMatch(workflow, /^\s+push:\s*$/m);
  assert.doesNotMatch(workflow, /^\s+pull_request:\s*$/m);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /interaction:/);
  assert.match(workflow, /visual:/);
  assert.match(workflow, /concurrency:\s*\n\s+group:/);
  assert.match(workflow, /cancel-in-progress:\s+false/);
  assert.match(workflow, /name: Build, Interaction, A11y/);
  assert.match(workflow, /if:\s*\$\{\{\s*inputs\.interaction\s*\}\}/);
  assert.match(workflow, /npm run build-storybook/);
  assert.match(workflow, /npm run test-storybook/);
  assert.match(workflow, /npm run install:trusted/);
  assert.match(workflow, /persist-credentials:\s+false/);
  assert.doesNotMatch(workflow, /\bnpm (?:ci|install)\b/);
  assert.match(workflow, /playwright install --with-deps chromium/);
  assert.match(workflow, /name: Visual Baselines/);
  assert.match(workflow, /if:\s*\$\{\{\s*inputs\.visual\s*\}\}/);
  assert.match(workflow, /npm run test:visual/);
  assert.match(workflow, /runs-on:\s+ubuntu-latest/);
  assert.doesNotMatch(workflow, /name: Detect visual changes/);
  assert.doesNotMatch(workflow, /git diff --name-only --diff-filter/);
  assert.match(
    preview,
    /pretendard\/dist\/web\/variable\/pretendardvariable\.css/,
  );
  assert.match(
    vitestConfig,
    /name:\s*"storybook"[\s\S]+?maxConcurrency:\s*1[\s\S]+?fileParallelism:\s*false/,
  );
  assert.match(
    manualMemberImportStories,
    /beforeEach:\s*async[\s\S]+?window\.fetch = STORYBOOK_FETCH[\s\S]+?await clearImageUploadDraft\(MANUAL_MEMBER_IMPORT_DRAFT_KEY\)[\s\S]+?window\.fetch = STORYBOOK_FETCH[\s\S]+?await clearImageUploadDraft\(MANUAL_MEMBER_IMPORT_DRAFT_KEY\)/,
  );
  assert.match(
    imageUploadDraftClient,
    /async function runImageUploadDraftTransaction[\s\S]+?request\.addEventListener\("success", \(\) => \{[\s\S]+?result = request\.result;[\s\S]+?transaction\.oncomplete = \(\) => resolve\(result\)/,
  );
  assert.doesNotMatch(workflow, /chromaui\/action|CHROMATIC_PROJECT_TOKEN/);
});

test("Public Readiness delegates canonical lockfile verification to the shared Quick profile", () => {
  const workflowsDirectory = new URL("../.github/workflows/", import.meta.url);
  const workflowNames = readdirSync(workflowsDirectory);
  const publicReadiness = readRepoFile(
    ".github/workflows/public-readiness.yml",
  );

  assert.equal(workflowNames.includes("lockfile-check.yml"), false);
  assert.match(publicReadiness, /npm run verify:change/);
  assert.match(readRepoFile("scripts/verify-change.mjs"), /runRequired\("verify:quick"\)/);
  const packageJson = JSON.parse(readRepoFile("package.json")) as {
    scripts: Record<string, string>;
  };
  assert.match(packageJson.scripts["verify:quick"], /check:lockfile/);
});

test("production Supabase migrations require an explicit guarded dispatch", () => {
  const workflow = readRepoFile(".github/workflows/production-migrations.yml");

  assert.match(workflow, /name: Apply Production Supabase Migrations/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+push:\s*$/m);
  assert.match(workflow, /confirmation:/);
  assert.match(workflow, /APPLY_PRODUCTION_MIGRATIONS/);
  assert.match(workflow, /expected_sha:/);
  assert.match(workflow, /maintenance_window_approved:/);
  assert.match(workflow, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /ref: main/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.match(
    workflow,
    /SUPABASE_PRODUCTION_DB_URL:\s*\$\{\{ secrets\.SUPABASE_PRODUCTION_DB_URL \}\}/,
  );
  assert.match(workflow, /npm run validate:migrations/);
  assert.match(
    workflow,
    /supabase migration list --db-url "\$SUPABASE_PRODUCTION_DB_URL"/,
  );
  assert.match(
    workflow,
    /supabase db push --db-url "\$SUPABASE_PRODUCTION_DB_URL" --yes --skip-vault/,
  );
  assert.match(
    workflow,
    /supabase db push --db-url "\$SUPABASE_PRODUCTION_DB_URL" --dry-run --skip-vault/,
  );
  assert.doesNotMatch(workflow, /--include-all/);
});

test("Preview Supabase migrations apply dev schema changes without syncing data", () => {
  const workflow = readRepoFile(".github/workflows/preview-migrations.yml");

  for (const requiredText of [
    "name: Apply Preview Supabase Migrations",
    "push:",
    "branches: [dev]",
    '"supabase/migrations/**"',
    '"supabase/schema.sql"',
    "workflow_dispatch:",
    "APPLY_PREVIEW_MIGRATIONS",
    "expected_dev_sha:",
    "github.event_name == 'push'",
    "github.ref == 'refs/heads/dev'",
    "github.ref == 'refs/heads/main'",
    "ref: ${{ steps.select-dev.outputs.sha }}",
    "npm run validate:migrations",
    "SUPABASE_PREVIEW_DB_URL",
    'supabase db push --db-url "$SUPABASE_PREVIEW_DB_URL" --yes',
  ]) {
    assert.match(
      workflow,
      new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }

  assert.doesNotMatch(
    workflow,
    /sync:preview|SUPABASE_PRODUCTION_DB_URL|--include-all|migration repair/,
  );
  assert.doesNotMatch(workflow, /ref: dev/);
  assert.doesNotMatch(workflow, /workflow_run:/);
  assert.match(workflow, /git ls-remote "\$REPOSITORY_URL" refs\/heads\/dev/);
  assert.match(workflow, /echo "is_current=false" >> "\$GITHUB_OUTPUT"/);
  assert.match(
    workflow,
    /name: Apply pending Preview migrations[\s\S]+?test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_DEV_SHA"[\s\S]+?git ls-remote origin refs\/heads\/dev[\s\S]+?supabase db push/,
  );
});

test("Preview data and Storage sync is an explicit exact-dev maintenance operation", () => {
  const workflow = readRepoFile(".github/workflows/preview-sync.yml");

  assert.match(workflow, /name: Sync Preview Supabase/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /workflow_run:/);
  assert.doesNotMatch(workflow, /^\s+push:\s*$/m);
  assert.match(workflow, /confirmation:/);
  assert.match(workflow, /SYNC_PREVIEW_DATA/);
  assert.match(workflow, /expected_dev_sha:/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /group:\s+preview-data-sync/);
  assert.match(workflow, /cancel-in-progress:\s+false/);
  assert.match(workflow, /ref: \$\{\{ steps\.select-dev\.outputs\.sha \}\}/);
  assert.doesNotMatch(workflow, /ref: dev/);
  assert.doesNotMatch(workflow, /ref: main/);
  assert.match(workflow, /git ls-remote origin refs\/heads\/dev/);
  assert.match(workflow, /run: npm run sync:preview/);
  assert.match(workflow, /SUPABASE_PRODUCTION_DB_URL/);
  assert.match(workflow, /SUPABASE_PREVIEW_SERVICE_ROLE_KEY/);
  assert.match(workflow, /node-version:\s+24\.18\.1/);
  assert.match(workflow, /npm run install:trusted/);
  assert.match(workflow, /version:\s+2\.114\.0/);
  assert.match(workflow, /persist-credentials:\s+false/);
  assert.doesNotMatch(workflow, /\bnpm (?:ci|install)\b/);
});

test("playwright config can use the CI-hosted Chrome channel", () => {
  const config = readRepoFile("playwright.config.ts");

  assert.match(config, /PLAYWRIGHT_CHROMIUM_CHANNEL/);
  assert.match(config, /channel: chromiumChannel/);
  assert.match(config, /video: chromiumChannel \? "off" : "retain-on-failure"/);
});

test("public repository exposes a responsible disclosure security policy", () => {
  const securityPolicy = readRepoFile("docs/SECURITY.md");

  assert.match(securityPolicy, /SSARTNERSHIP Security Policy/);
  assert.match(securityPolicy, /myknow@ssafy\.com/);
  assert.match(securityPolicy, /public/i);
  assert.match(securityPolicy, /personal data/i);
});

test("public readiness TODO keeps the launch blocker remediation tracked", () => {
  const todo = readRepoFile("docs/history/product/todo-2026-08-13.md");

  assert.match(todo, /공개 readiness 보완/);
  assert.match(todo, /Issue #55/);
  assert.match(todo, /Mattermost 직접 연동 전환 \(Issue #155\)/);
  assert.match(todo, /GitHub Actions 공개 readiness gate/);
});
