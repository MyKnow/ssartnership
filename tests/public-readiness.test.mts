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
      ...workflow.matchAll(/node-version:\s*["']?(\d+)["']?/g),
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
      new Set(["24"]),
      `${filename}: project commands must run on Node 24`,
    );
    assert.match(
      workflow,
      /permissions:\s*\n\s+contents: read/,
      `${filename}: repository token must remain read-only`,
    );
  }
});

test("public readiness CI workflow gates launch-critical checks", () => {
  const workflow = readRepoFile(".github/workflows/public-readiness.yml");

  for (const requiredText of [
    "name: Public Readiness",
    "pull_request:",
    "workflow_dispatch:",
    "node-version: 24.18.1",
    "npm ci",
    "npm run check:lockfile",
    "npm run validate:migrations",
    "npm run lint",
    "npm run typecheck:ci",
    "npm test",
    "npm audit --omit=dev",
    "npm run audit:security",
    "npm run build",
    "PLAYWRIGHT_CHROMIUM_CHANNEL: chrome",
    "npm run test:e2e",
  ]) {
    assert.match(
      workflow,
      new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }

  assert.match(workflow, /push:\s*\n\s+branches:\s*\[main, dev\]/);
  assert.match(workflow, /^\s+pull_request:\s*$/m);
  assert.match(workflow, /concurrency:\s*\n\s+group:/);
  assert.match(workflow, /cancel-in-progress:\s+true/);
  assert.match(workflow, /name: Dependency audit/);
  assert.doesNotMatch(
    workflow,
    /if:\s*\$\{\{\s*github\.event_name != 'pull_request' \|\| !github\.event\.pull_request\.draft\s*\}\}/,
  );
});

test("local prepush and release use the same Public Readiness gates", () => {
  const packageJson = JSON.parse(readRepoFile("package.json")) as {
    scripts: Record<string, string>;
  };
  const prepush = packageJson.scripts.prepush;

  for (const requiredCommand of [
    "npm run check:lockfile",
    "npm run validate:migrations",
    "npm run lint",
    "npm run typecheck:ci",
    "npm test",
    "npm run audit:security",
    "npm run build",
    "npm run test:e2e:ci",
  ]) {
    assert.match(
      prepush,
      new RegExp(requiredCommand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }

  const release = readRepoFile("scripts/release.sh");
  assert.match(
    release,
    /run_repository_prepush[\s\S]+?npm run build-storybook[\s\S]+?npm run test-storybook[\s\S]+?npm run test:visual/,
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

test("Storybook interaction runs automatically, isolates shared state, and keeps pixel baselines manual", () => {
  const workflow = readRepoFile(".github/workflows/storybook.yml");
  const preview = readRepoFile(".storybook/preview.tsx");
  const vitestConfig = readRepoFile("vitest.config.ts");
  const manualMemberImportStories = readRepoFile(
    "src/components/admin/AdminMemberManualAddPanel.stories.tsx",
  );
  const imageUploadDraftClient = readRepoFile("src/lib/image-upload/draft.client.ts");

  assert.match(workflow, /name: Storybook and Visual Baselines/);
  assert.match(workflow, /push:\s*\n\s+branches:\s*\[main, dev\]/);
  assert.match(
    workflow,
    /pull_request:\s*\n\s+types:\s*\[opened, synchronize, reopened, ready_for_review\]/,
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /concurrency:\s*\n\s+group:/);
  assert.match(workflow, /cancel-in-progress:\s+true/);
  assert.match(workflow, /name: Build, Interaction, A11y/);
  assert.match(workflow, /if:\s*\$\{\{\s*github\.event_name != 'pull_request' \|\| !github\.event\.pull_request\.draft\s*\}\}/);
  assert.match(workflow, /npm run build-storybook/);
  assert.match(workflow, /npm run test-storybook/);
  assert.match(workflow, /playwright install --with-deps chromium/);
  assert.match(workflow, /name: Visual Baselines/);
  assert.match(workflow, /if:\s*\$\{\{\s*github\.event_name == 'workflow_dispatch'\s*\}\}/);
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

test("Public Readiness owns canonical lockfile verification without a standalone workflow", () => {
  const workflowsDirectory = new URL("../.github/workflows/", import.meta.url);
  const workflowNames = readdirSync(workflowsDirectory);
  const publicReadiness = readRepoFile(
    ".github/workflows/public-readiness.yml",
  );

  assert.equal(workflowNames.includes("lockfile-check.yml"), false);
  assert.match(
    publicReadiness,
    /jobs:\s*\n\s+verify:\s*\n\s+name: Lint, Test, Build, Security, E2E[\s\S]+?name: Verify lockfile\s*\n\s+run: npm run check:lockfile/,
  );
  assert.equal(
    [...publicReadiness.matchAll(/run:\s*npm run check:lockfile/g)].length,
    1,
  );
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
    "branches: [main]",
    "workflow_dispatch:",
    "APPLY_PREVIEW_MIGRATIONS",
    "[apply-preview-migrations]",
    "github.ref == 'refs/heads/main'",
    "ref: dev",
    "npm run validate:migrations",
    "SUPABASE_PREVIEW_DB_URL",
    'supabase db push --db-url "$SUPABASE_PREVIEW_DB_URL" --yes',
    "Repair stale Preview migration history",
    "[repair-preview-migration-history]",
    "supabase migration repair",
    "--status reverted",
    "20260712133729 20260712143858",
  ]) {
    assert.match(
      workflow,
      new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }

  assert.match(
    workflow,
    /name: Repair stale Preview migration history[\s\S]+?github\.event_name == 'push' &&[\s\S]+?contains\(github\.event\.head_commit\.message, '\[repair-preview-migration-history\]'\)[\s\S]+?supabase migration repair[\s\S]+?--status reverted[\s\S]+?20260712133729 20260712143858/,
  );
  assert.doesNotMatch(
    workflow,
    /sync:preview|SUPABASE_PRODUCTION_DB_URL|--include-all/,
  );
});

test("Preview sync follows the latest successful dev public-readiness run without stale reruns", () => {
  const workflow = readRepoFile(".github/workflows/preview-sync.yml");

  assert.match(workflow, /name: Sync Preview Supabase/);
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows:\s*\n\s+- Public Readiness/);
  assert.match(workflow, /branches:\s*\[dev\]/);
  assert.match(workflow, /types:\s*\n\s+- completed/);
  assert.match(workflow, /group:\s+preview-sync/);
  assert.match(workflow, /cancel-in-progress:\s+false/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/dev'/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.event\.workflow_run\.event == 'push'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'dev'/);
  assert.match(workflow, /name: Guard stale dev workflow SHA/);
  assert.match(workflow, /git ls-remote origin refs\/heads\/dev/);
  assert.match(workflow, /steps\.stale-sha\.outputs\.is_current == 'true'/);
});

test("playwright config can use the CI-hosted Chrome channel", () => {
  const config = readRepoFile("playwright.config.ts");

  assert.match(config, /PLAYWRIGHT_CHROMIUM_CHANNEL/);
  assert.match(config, /channel: chromiumChannel/);
  assert.match(config, /video: chromiumChannel \? "off" : "retain-on-failure"/);
});

test("public repository exposes a responsible disclosure security policy", () => {
  const securityPolicy = readRepoFile("SECURITY.md");

  assert.match(securityPolicy, /SSARTNERSHIP Security Policy/);
  assert.match(securityPolicy, /myknow@ssafy\.com/);
  assert.match(securityPolicy, /public/i);
  assert.match(securityPolicy, /personal data/i);
});

test("public readiness TODO keeps the launch blocker remediation tracked", () => {
  const todo = readRepoFile("docs/product/todo.md");

  assert.match(todo, /공개 readiness 보완/);
  assert.match(todo, /Issue #55/);
  assert.match(todo, /Mattermost 직접 연동 전환 \(Issue #155\)/);
  assert.match(todo, /GitHub Actions 공개 readiness gate/);
});
