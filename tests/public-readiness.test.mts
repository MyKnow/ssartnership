import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { createRequire } from "node:module";
import { selectEnvironmentProfile } from "../scripts/lib/project-environment.mjs";

const { load: parse } = createRequire(import.meta.url)("js-yaml");

function readRepoFile(pathname: string) {
  return readFileSync(new URL(`../${pathname}`, import.meta.url), "utf8");
}

const WORKFLOW_FILES = [
  "admin-performance.yml",
  "cross-platform-development.yml",
  "public-readiness.yml",
  "self-host-public-health.yml",
  "storybook.yml",
] as const;

const CHECKOUT_ACTION_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";
const CHECKOUT_ACTION_VERSION = "v7.0.1";
const SETUP_NODE_ACTION_SHA = "820762786026740c76f36085b0efc47a31fe5020";
const SETUP_NODE_ACTION_VERSION = "v7.0.0";

test("GitHub Actions use the Node 24 action runtime and project runtime with read-only repository access", () => {
  for (const filename of WORKFLOW_FILES) {
    const workflow = readRepoFile(`.github/workflows/${filename}`);
    const checkoutVersions = [
      ...workflow.matchAll(
        new RegExp(`actions/checkout@(${CHECKOUT_ACTION_SHA})\\s+#\\s+(${CHECKOUT_ACTION_VERSION})`, "g"),
      ),
    ].map((match) => `${match[1]}#${match[2]}`);
    const setupNodeVersions = [
      ...workflow.matchAll(
        new RegExp(`actions/setup-node@(${SETUP_NODE_ACTION_SHA})\\s+#\\s+(${SETUP_NODE_ACTION_VERSION})`, "g"),
      ),
    ].map((match) => `${match[1]}#${match[2]}`);
    const projectNodeVersions = [
      ...workflow.matchAll(/node-version:\s*["']?([^\s"'#]+)["']?/g),
    ].map((match) => match[1]);

    assert.ok(checkoutVersions.length > 0, `${filename}: checkout action missing`);
    assert.deepEqual(
      new Set(checkoutVersions),
      new Set([`${CHECKOUT_ACTION_SHA}#${CHECKOUT_ACTION_VERSION}`]),
      `${filename}: checkout must use the reviewed upstream SHA with a readable release comment`,
    );
    assert.ok(setupNodeVersions.length > 0, `${filename}: setup-node action missing`);
    assert.deepEqual(
      new Set(setupNodeVersions),
      new Set([`${SETUP_NODE_ACTION_SHA}#${SETUP_NODE_ACTION_VERSION}`]),
      `${filename}: setup-node must use the reviewed upstream SHA with a readable release comment`,
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

test("auth E2E mock reset follows successful login preparation without disposable browser navigation", () => {
  const authOperations = readRepoFile("tests/e2e/auth-ops.spec.ts");
  const preparation = authOperations.slice(authOperations.indexOf("test.beforeEach"), authOperations.indexOf('test("manual member setup'));
  const readinessIndex = preparation.indexOf('await page.request.get("/auth/login")');
  const successIndex = preparation.indexOf("expect(warmupResponse.ok()).toBe(true)");
  const resetIndex = preparation.indexOf('page.request.post("/api/e2e/mock/reset")');

  assert.ok(readinessIndex >= 0, "auth operations must prepare the login route first");
  assert.ok(successIndex > readinessIndex, "the preparation response must succeed");
  assert.ok(resetIndex > successIndex, "mock reset must follow successful preparation");
  assert.doesNotMatch(preparation, /page\.goto|networkidle|waitForTimeout/);
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
      /uses:\s*actions\/(checkout|setup-node)@([0-9a-f]{40})\s+#\s+(v\d+(?:\.\d+)*)/g,
    );

    for (const action of actions) {
      actionCount += 1;
      if (action[1] === "checkout") {
        assert.equal(action[2], CHECKOUT_ACTION_SHA, `${workflowName} must pin checkout to the reviewed SHA`);
        assert.equal(action[3], CHECKOUT_ACTION_VERSION, `${workflowName} must document the checkout release`);
      } else {
        assert.equal(action[2], SETUP_NODE_ACTION_SHA, `${workflowName} must pin setup-node to the reviewed SHA`);
        assert.equal(action[3], SETUP_NODE_ACTION_VERSION, `${workflowName} must document the setup-node release`);
      }
    }
  }

  assert.ok(actionCount > 0, "expected active workflows to use GitHub Node actions");
});

test("retired Cloud migration CLI actions are not reintroduced", () => {
  const workflowsDirectory = new URL("../.github/workflows/", import.meta.url);
  for (const name of readdirSync(workflowsDirectory).filter(name => /\.ya?ml$/.test(name))) {
    assert.doesNotMatch(readFileSync(new URL(name, workflowsDirectory), "utf8"), /supabase\/setup-cli@/, name);
  }
});

test("Dependabot tracks pinned GitHub Actions workflow refs", () => {
  const config = readRepoFile(".github/dependabot.yml");

  assert.match(config, /^version:\s*2$/m);
  assert.match(config, /package-ecosystem:\s*github-actions/);
  assert.match(config, /directory:\s*["']\/["']/);
  assert.match(config, /schedule:\s*\n\s+interval:\s*weekly/);
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
    /pretendard\/dist\/web\/variable\/pretendardvariable-dynamic-subset\.css/,
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

test("retired cloud migration and sync workflows stay removed", () => {
  const workflowsDirectory = new URL("../.github/workflows/", import.meta.url);
  const workflowNames = readdirSync(workflowsDirectory)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort();

  assert.ok(!workflowNames.includes("production-migrations.yml"));
  assert.ok(!workflowNames.includes("preview-migrations.yml"));
  assert.ok(!workflowNames.includes("preview-sync.yml"));

  for (const workflowName of workflowNames) {
    const workflow = readFileSync(new URL(workflowName, workflowsDirectory), "utf8");

    // Frozen cloud baselines must not receive DDL or data again.
    assert.doesNotMatch(workflow, /supabase\s+db\s+push|supabase\s+migration\s+(?:up|repair)|APPLY_PRODUCTION_MIGRATIONS/, workflowName);
    assert.doesNotMatch(workflow, /supabase db push --db-url "\$SUPABASE_PREVIEW_DB_URL"/, workflowName);
    assert.doesNotMatch(workflow, /npm run sync:preview|supabase-sync-preview/, workflowName);
    assert.doesNotMatch(workflow, /app_id=\$SUPABASE_GITHUB_APP_ID|\.app\.id == 330661/, workflowName);
    // Self-host schema approval stays an operator-written file, never CI-written.
    assert.doesNotMatch(workflow, /schema-approval\.json/, workflowName);
  }
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

test("CI build steps select an explicit secret-free mock profile without local dotenv files", () => {
  const workflow = parse(readRepoFile(".github/workflows/public-readiness.yml"));
  for (const id of ["promotion-smoke", "full-release"]) {
    const step = workflow.jobs.verify.steps.find((value: { id?: string }) => value.id === id);
    assert.ok(step);
    assert.equal(selectEnvironmentProfile({ command: "build", environment: { CI: "true", ...step.env } }), "injected");
    assert.equal(step.env.NEXT_PUBLIC_DATA_SOURCE, "mock");
    assert.equal(step.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE, "mock");
  }
});


test("external self-host verification is manual, fixed-scope and GitHub hosted", () => {
  const workflow = parse(readRepoFile(".github/workflows/self-host-public-health.yml"));
  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.deepEqual(workflow.permissions, {contents:"read"});
  assert.equal(workflow.jobs.verify["runs-on"], "ubuntu-24.04");
  assert.equal(workflow.jobs.verify.steps.at(-1).run, "node scripts/self-host-operations/verify-public-health.mjs");
  assert.doesNotMatch(readRepoFile(".github/workflows/self-host-public-health.yml"), /secrets\.|schedule:|inputs:|continue-on-error/);
});
