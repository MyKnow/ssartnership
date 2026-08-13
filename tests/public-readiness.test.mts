import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function readRepoFile(pathname: string) {
  return readFileSync(new URL(`../${pathname}`, import.meta.url), "utf8");
}

const WORKFLOW_FILES = [
  "admin-performance.yml",
  "lockfile-check.yml",
  "preview-migrations.yml",
  "preview-sync.yml",
  "production-migrations.yml",
  "public-readiness.yml",
  "storybook.yml",
] as const;

test("GitHub Actions use the Node 24 action runtime with read-only repository access", () => {
  for (const filename of WORKFLOW_FILES) {
    const workflow = readRepoFile(`.github/workflows/${filename}`);
    const checkoutVersions = [
      ...workflow.matchAll(/actions\/checkout@(v\d+(?:\.\d+)*)/g),
    ].map((match) => match[1]);
    const setupNodeVersions = [
      ...workflow.matchAll(/actions\/setup-node@(v\d+(?:\.\d+)*)/g),
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
    "node-version: 24",
    "npm ci",
    "npm run check:lockfile",
    "npm run validate:migrations",
    "npm run lint",
    "npm run typecheck:ci",
    "npm test",
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
  assert.match(workflow, /concurrency:\s*\n\s+group:/);
  assert.match(workflow, /cancel-in-progress:\s+true/);
  assert.doesNotMatch(workflow, /npm audit --omit=dev/);
  assert.match(workflow, /name: Dependency policy audit/);
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

test("Storybook and visual baselines run for pull requests and shared branches without Chromatic", () => {
  const workflow = readRepoFile(".github/workflows/storybook.yml");

  assert.match(workflow, /name: Storybook and Visual Baselines/);
  assert.match(workflow, /push:\s*\n\s+branches:\s*\[main, dev\]/);
  assert.match(workflow, /^\s+pull_request:\s*$/m);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /concurrency:\s*\n\s+group:/);
  assert.match(workflow, /cancel-in-progress:\s+true/);
  assert.match(workflow, /npm run build-storybook/);
  assert.match(workflow, /npm run test-storybook/);
  assert.match(workflow, /playwright install --with-deps chromium/);
  assert.match(workflow, /npm run test:visual/);
  assert.doesNotMatch(workflow, /chromaui\/action|CHROMATIC_PROJECT_TOKEN/);
});

test("lockfile verification avoids duplicate feature-branch runs while retaining pull request coverage", () => {
  const workflow = readRepoFile(".github/workflows/lockfile-check.yml");

  assert.match(workflow, /push:\s*\n\s+branches:\s*\[main, dev\]/);
  assert.match(workflow, /^\s+pull_request:\s*$/m);
  assert.match(workflow, /concurrency:\s*\n\s+group:/);
  assert.match(workflow, /cancel-in-progress:\s+true/);
});

test("production Supabase migrations require an explicit guarded dispatch", () => {
  const workflow = readRepoFile(".github/workflows/production-migrations.yml");

  assert.match(workflow, /name: Apply Production Supabase Migrations/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+push:\s*$/m);
  assert.match(workflow, /confirmation:/);
  assert.match(workflow, /APPLY_PRODUCTION_MIGRATIONS/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
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
    /supabase db push --db-url "\$SUPABASE_PRODUCTION_DB_URL" --yes/,
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
