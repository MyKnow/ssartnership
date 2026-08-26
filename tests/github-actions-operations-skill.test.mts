import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const skillPath = ".agents/skills/github-actions-operations/SKILL.md";
const ledgerPath =
  ".agents/skills/github-actions-operations/references/failure-ledger.md";
const scriptPath =
  ".agents/skills/github-actions-operations/scripts/audit-actions-run.mjs";
const retainedAuditPath =
  ".agents/skills/github-actions-operations/references/retained-actions-audit.md";

const reviewedWorkflowNpmCommands = new Set([
  "npm audit --omit=dev",
  "npm run audit:security",
  "npm run build",
  "npm run build-storybook",
  "npm run bootstrap -- --ci --skip-install",
  "npm run check:cross-platform",
  "npm run check:lockfile",
  "npm run doctor -- --ci",
  "npm run install:trusted",
  "npm run lint",
  "npm run measure:admin:preview",
  "npm run sync:preview",
  "npm run test:e2e:ci",
  "npm run test-storybook",
  "npm run test:visual",
  "npm run typecheck:ci",
  "npm run validate:migrations",
  "npm run verify:change --\n--base \"$BASE_SHA\"\n--head \"$HEAD_SHA\"\n--event \"$EVENT_NAME\"\n--base-ref \"$BASE_REF\"\n--force-full \"$FORCE_FULL\"\n--expected-level \"$EXPECTED_LEVEL\"",
  "npm run verify:promotion:smoke",
  "npm run verify:release:post-quick",
  "npm test",
]);

function workflowRunBodies(workflow: string) {
  const lines = workflow.split(/\r?\n/);
  const bodies: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)(?:-\s+)?run:\s*(.*?)\s*$/);
    if (!match) continue;
    const [, indentation, scalar] = match;
      if (/^[>|][+-]?$/.test(scalar)) {
        const content: string[] = [];
        for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
          const line = lines[cursor];
          if (line === undefined) break;
          const indentationWidth = line.match(/^\s*/)?.[0]?.length ?? 0;
          if (line.trim() && indentationWidth <= indentation.length) break;
          content.push(line.trim());
          index = cursor;
        }
      bodies.push(content.filter(Boolean).join("\n"));
      continue;
    }
    bodies.push(scalar.replace(/^(['"])([\s\S]*)\1$/, "$2"));
  }
  return bodies;
}

function unreviewedWorkflowNpmCommands(workflow: string) {
  return workflowRunBodies(workflow).filter(
    (body) => /\bnpm\b/.test(body) && !reviewedWorkflowNpmCommands.has(body),
  );
}

function workflowJobBodies(workflow: string) {
  const lines = workflow.split(/\r?\n/);
  const jobsIndex = lines.findIndex((line) => line === "jobs:");
  if (jobsIndex < 0) return [];
  const jobs: Array<{ name: string; source: string }> = [];
  for (let index = jobsIndex + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (!match) continue;
    const start = index;
    let end = lines.length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[cursor])) {
        end = cursor;
        break;
      }
    }
    jobs.push({ name: match[1], source: lines.slice(start, end).join("\n") });
    index = end - 1;
  }
  return jobs;
}

function workflowInstallBoundaryErrors(workflow: string) {
  const errors: string[] = [];
  for (const job of workflowJobBodies(workflow)) {
    const npmCommands = workflowRunBodies(job.source).filter((body) => /\bnpm\b/.test(body));
    if (npmCommands.length === 0) continue;
    const installCommand = "npm run install:trusted";
    if (
      npmCommands[0] !== installCommand
      || npmCommands.filter((command) => command === installCommand).length !== 1
    ) {
      errors.push(`${job.name}:trusted-install-order`);
      continue;
    }
    const installIndex = job.source.indexOf(`run: ${installCommand}`);
    const setupIndex = job.source.indexOf("uses: actions/setup-node@v7");
    const checkoutIndex = job.source.indexOf("uses: actions/checkout@v7");
    const preInstallSource = job.source.slice(0, installIndex);
    if (
      checkoutIndex < 0
      || checkoutIndex > installIndex
      || !/uses: actions\/checkout@v7[\s\S]*?persist-credentials:\s*false/.test(
        preInstallSource,
      )
    ) {
      errors.push(`${job.name}:trusted-checkout`);
    }
    if (
      setupIndex < 0
      || setupIndex > installIndex
      || !/node-version:\s*24\.18\.1/.test(preInstallSource)
      || !/NPM_CONFIG_CACHE:\s*\$\{\{ github\.workspace \}\}\/\.tmp\/npm-cache/.test(
        preInstallSource,
      )
    ) {
      errors.push(`${job.name}:trusted-node-setup`);
    }
    const credentialPositions = [
      job.source.indexOf("${{ secrets."),
      job.source.indexOf("${{ github.token }}"),
    ].filter((position) => position >= 0);
    if (credentialPositions.some((position) => position < installIndex)) {
      errors.push(`${job.name}:preinstall-credential`);
    }
  }
  return errors;
}

test("Actions-affecting operations trigger the dedicated skill", () => {
  const skill = read(skillPath);
  const frontmatter = skill.match(/^---\n([\s\S]+?)\n---/)?.[1];

  assert.ok(frontmatter, "skill frontmatter missing");
  for (const trigger of [
    "git push",
    "PR open/update/ready/merge",
    "tag or release",
    "workflow dispatch/rerun/cancel/delete",
    "branch-protection edits",
    "dev/main promotion",
  ]) {
    assert.match(frontmatter, new RegExp(trigger.replace(/[/.]/g, "\\$&"), "i"));
  }
});

test("the skill fails closed before a remote trigger", () => {
  const skill = read(skillPath);

  assert.match(skill, /Read this file completely/);
  assert.match(skill, /Read \[failure-ledger\.md\]\(references\/failure-ledger\.md\) completely/);
  assert.match(skill, /Do not push, merge, dispatch, or change PR state while Preview sync/);
  assert.match(skill, /Perform one deliberate remote mutation/);
  assert.match(skill, /re-read it before Production promotion or a privileged shared-state mutation/);
  assert.match(skill, /designate exactly one remote-mutation owner/);
  assert.match(
    skill,
    /Monitoring, audit, diagnostic, review, and cleanup workers remain read-only/,
  );
  assert.match(skill, /every registered worktree for that branch/);
  assert.match(
    skill,
    /Never merge a PR while its exact-head first-attempt log audit is still running/,
  );
  assert.match(skill, /then `npm run verify:change`/);
  assert.match(skill, /Run `npm run verify:release` before a `dev` to `main` promotion/);
  assert.match(skill, /Inspect the complete local output, not only its exit code/);
  assert.match(skill, /interrupt it before `receive-pack`/);
  assert.match(skill, /prove that no remote branch\/run\/deployment was created/);
  assert.match(skill, /`gh workflow list`/);
});

test("blocking abnormal runs update the skill before another trigger", () => {
  const skill = read(skillPath);

  assert.match(skill, /success log containing hidden retry\/flaky\/error evidence/);
  assert.match(skill, /Never delete, cancel, or rerun it to manufacture a green history/);
  assert.match(skill, /always update \[failure-ledger\.md\]\(references\/failure-ledger\.md\)/);
  assert.match(skill, /update this `SKILL\.md` too when the reusable procedure itself was incomplete/);
  assert.match(
    skill,
    /Repeated repository-controlled failures, hidden retries, errors, or changed warning counts\/context still extend the ledger/,
  );
  assert.match(skill, /Recovered external-provider transients may be batched before Production promotion/);
  assert.match(
    skill,
    /exact recurrence of an explicitly reviewed, non-actionable tooling-warning baseline/,
  );
  assert.match(skill, /Fix repository-controlled causes in a new commit/);
  assert.match(skill, /independent fresh-server repetitions for isolation/);
  assert.match(skill, /complete CI-shaped Playwright invocation/);
  assert.match(skill, /Preserve a `--repeat-each` server exit or connection refusal/);
  assert.match(skill, /do not dismiss it or retry it into green/);
  assert.match(skill, /A successful job with a retry is an abnormal run/);
  assert.match(skill, /Keep remote Playwright fail-closed/);
  assert.match(
    skill,
    /responsive screenshot loop for one route must navigate once and resize the loaded page/,
  );
  assert.match(
    skill,
    /browser must not open fire-and-forget\/keepalive product-event requests/,
  );
  assert.match(skill, /Do not add a suite-wide request-drain `afterEach`/);
  assert.match(
    skill,
    /wait for the dialog's declared initial-focus target before typing/,
  );
  assert.match(skill, /For a proven external-only outage/);
  assert.match(
    skill,
    /A recovered Storage retry remains an operational observation even when every bucket and the post-sync migration check succeed/,
  );
  assert.match(skill, /Audit Completeness Gate/);
});

test("modal Story interactions wait for initial focus before controlled input", () => {
  const story = read(
    "src/components/admin/push-manager/PushComposerSection.stories.tsx",
  );
  const recipientDialog = story.indexOf("const recipientDialog = within(");
  const initialFocusWait = story.indexOf(
    "await waitFor(",
    recipientDialog,
  );
  const initialFocus = story.indexOf(
    "expect(recipientCloseButton).toHaveFocus()",
    initialFocusWait,
  );
  const searchClick = story.indexOf(
    "await userEvent.click(recipientSearch)",
    recipientDialog,
  );
  const searchFocus = story.indexOf(
    "await expect(recipientSearch).toHaveFocus()",
    recipientDialog,
  );
  const searchType = story.indexOf(
    'await userEvent.type(recipientSearch, "ops")',
    recipientDialog,
  );
  const controlledValue = story.indexOf(
    'await expect(recipientSearch).toHaveValue("ops")',
    recipientDialog,
  );
  const filteredResult = story.indexOf(
    'await recipientDialog.findByText("현재 표시 1명"',
    recipientDialog,
  );

  assert.ok(recipientDialog >= 0);
  assert.ok(initialFocusWait > recipientDialog);
  assert.ok(initialFocus > initialFocusWait);
  assert.ok(searchClick > initialFocus);
  assert.ok(searchFocus > searchClick);
  assert.ok(searchType > searchFocus);
  assert.ok(controlledValue > searchType);
  assert.ok(filteredResult > controlledValue);
});

test("required Playwright checks cannot hide a failed first attempt", () => {
  const config = read("playwright.config.ts");

  assert.match(config, /retries:\s*0/);
  assert.doesNotMatch(config, /retries:\s*process\.env\.CI/);
  assert.match(config, /trace:\s*"retain-on-failure"/);
  assert.match(config, /non-loopback BASE_URL requires an explicit/);
});

test("required type checking cannot retry a failed first attempt into green", () => {
  const typecheck = read("scripts/typecheck-ci.mjs");

  assert.equal(typecheck.match(/runTypecheck\(\)/g)?.length, 2);
  assert.match(typecheck, /process\.exit\(runTypecheck\(\)\)/);
  assert.doesNotMatch(typecheck, /재시도|retry/i);
  assert.doesNotMatch(typecheck, /--noCheck/);
});

test("trusted dependency installation disables every lifecycle and verifies one pinned binary", async () => {
  const packageJson = JSON.parse(read("package.json")) as {
    allowScripts?: Record<string, boolean>;
    scripts?: Record<string, string>;
  };
  const packageLock = JSON.parse(read("package-lock.json")) as {
    packages?: Record<string, {
      version?: string;
      hasInstallScript?: boolean;
      resolved?: string;
      integrity?: string;
    }>;
  };
  const installScriptGate = read("scripts/check-install-scripts.mjs");
  const trustedInstaller = read("scripts/install-dependencies.mjs");
  const npmConfig = read(".npmrc");
  const vercel = JSON.parse(read("vercel.json")) as { installCommand?: string };
  const policyModule = await import(
    new URL("../scripts/check-install-scripts.mjs", import.meta.url).href
  ) as {
    validateStaticInstallPolicy: (input: {
      packageJson: unknown;
      packageLock: unknown;
      npmConfig: string;
      vendorPackageJson: unknown;
      vendorDigests: Record<string, string>;
    }) => void;
    validateEffectiveNpmConfig: (input: {
      npmVersionText: string;
      githubActions?: boolean;
      config: {
        allowGit: string;
        ignoreScripts: string;
        omitLockfileRegistryResolved: string;
      };
    }) => void;
    buildControlledInstallEnvironment: (
      source?: Record<string, string | undefined>,
    ) => Record<string, string>;
    resolveTrustedNpmCliPath: (
      source?: Record<string, string | undefined>,
    ) => string;
  };

  assert.deepEqual(packageJson.allowScripts, {
    "esbuild@0.28.1": false,
    "unrs-resolver": false,
  });
  assert.equal(
    packageLock.packages?.["node_modules/unrs-resolver"]?.version,
    "1.11.1",
  );
  assert.equal(
    packageLock.packages?.["node_modules/unrs-resolver"]?.hasInstallScript,
    true,
  );
  assert.match(npmConfig, /^allow-git=none$/m);
  assert.match(npmConfig, /^ignore-scripts=true$/m);
  assert.match(npmConfig, /^omit-lockfile-registry-resolved=false$/m);
  assert.doesNotMatch(npmConfig, /strict-allow-scripts|dangerously-allow-all-scripts/);
  assert.match(installScriptGate, /minimumNpmVersion/);
  assert.match(installScriptGate, /allow-git/);
  assert.match(installScriptGate, /ignore-scripts/);
  assert.match(installScriptGate, /resolved/);
  assert.match(
    installScriptGate,
    /sha512-HrJrvZv5ayxBzPfwphOoNzkzOIIlifzk0KJrGK2c8R4\+LKpMtpYLQeUdjnwjWv\/LZlkH2laZk\+4w78pi99D4Vw==/,
  );
  assert.match(installScriptGate, /allowScripts policy changed/);
  assert.match(installScriptGate, /root install lifecycle scripts are forbidden/);
  assert.match(installScriptGate, /workspace lifecycle scripts require/);
  assert.match(installScriptGate, /dependency lifecycle inventory changed/);
  assert.match(trustedInstaller, /"ci",[\s\S]+?"--ignore-scripts",[\s\S]+?"--include=dev",[\s\S]+?"--include=optional"/);
  assert.match(trustedInstaller, /"--allow-git=none"/);
  assert.doesNotMatch(trustedInstaller, /node_modules\/esbuild\/install\.js/);
  assert.match(trustedInstaller, /trusted esbuild binary version mismatch/);
  assert.match(trustedInstaller, /trusted esbuild binary integrity mismatch/);
  assert.match(installScriptGate, /pinnedPlatformPackages/);
  assert.match(installScriptGate, /unreviewed non-registry dependency source/);
  assert.match(installScriptGate, /expectedVendorDigests/);
  assert.match(installScriptGate, /buildControlledInstallEnvironment/);
  assert.match(
    read("package.json"),
    /"prepush": "npm run verify:change"/,
  );
  assert.equal(packageJson.scripts?.["install:trusted"], "node scripts/install-dependencies.mjs");
  assert.equal(vercel.installCommand, "npm run install:trusted");

  const vendorPackageJson = JSON.parse(read("vendor/archiver-cjs-compat/package.json"));
  const vendorDigests = {
    "index.cjs": "b134f0e3fc2341c955a372e7641b192aaff2acc8a9befb4f60d0a382ba9c0323",
    "package.json": "5529d14c75bcb148726dbff0cf37a5267f125305895584d9c051b3ec317a8f18",
  };
  const staticPolicy = {
    packageJson,
    packageLock,
    npmConfig,
    vendorPackageJson,
    vendorDigests,
  };

  assert.doesNotThrow(() => policyModule.validateStaticInstallPolicy(staticPolicy));
  assert.throws(
    () => policyModule.validateStaticInstallPolicy({
      ...staticPolicy,
      packageJson: {
        ...packageJson,
        scripts: { ...packageJson.scripts, prepare: "node hostile-prepare.mjs" },
      },
    }),
    /root install lifecycle scripts are forbidden/,
  );
  for (const scriptName of [
    "predependencies",
    "postdependencies",
    "preinstall:trusted",
    "postinstall:trusted",
  ]) {
    assert.throws(
      () => policyModule.validateStaticInstallPolicy({
        ...staticPolicy,
        packageJson: {
          ...packageJson,
          scripts: {
            ...packageJson.scripts,
            [scriptName]: "node hostile-install-hook.mjs",
          },
        },
      }),
      /root install lifecycle scripts are forbidden/,
      scriptName,
    );
  }
  assert.throws(
    () => policyModule.validateStaticInstallPolicy({
      ...staticPolicy,
      packageJson: { ...packageJson, workspaces: ["packages/*"] },
    }),
    /workspace lifecycle scripts require/,
  );
  assert.throws(
    () => policyModule.validateStaticInstallPolicy({
      ...staticPolicy,
      vendorPackageJson: {
        ...(vendorPackageJson as Record<string, unknown>),
        scripts: { prepare: "node hostile-prepare.mjs" },
      },
    }),
    /reviewed local archiver package manifest changed/,
  );
  assert.throws(
    () => policyModule.validateEffectiveNpmConfig({
      npmVersionText: "10.9.2",
      config: {
        allowGit: "none",
        ignoreScripts: "true",
        omitLockfileRegistryResolved: "false",
      },
    }),
    /11\.12\.1 through 11\.x/,
  );
  assert.throws(
    () => policyModule.validateStaticInstallPolicy({
      ...staticPolicy,
      npmConfig: `${npmConfig}allow-git=all\n`,
    }),
    /controls changed or contain an override/,
  );
  assert.doesNotThrow(() => policyModule.validateEffectiveNpmConfig({
    npmVersionText: "11.12.1",
    config: {
      allowGit: "none",
      ignoreScripts: "true",
      omitLockfileRegistryResolved: "false",
    },
  }));
  assert.doesNotThrow(() => policyModule.validateEffectiveNpmConfig({
    npmVersionText: "11.12.1",
    config: {
      allowGit: "none",
      ignoreScripts: "true",
      omitLockfileRegistryResolved: "false",
    },
  }));
  assert.throws(
    () => policyModule.validateEffectiveNpmConfig({
      npmVersionText: "11.12.0",
      config: {
        allowGit: "none",
        ignoreScripts: "true",
        omitLockfileRegistryResolved: "false",
      },
    }),
    /11\.12\.1 through 11\.x/,
  );
  assert.throws(
    () => policyModule.validateStaticInstallPolicy({
      ...staticPolicy,
      packageJson: {
        ...packageJson,
        dependencies: { ...((packageJson as { dependencies?: object }).dependencies ?? {}), hostile: "git+https://example.invalid/hostile.git" },
      },
    }),
    /unreviewed non-registry dependency source/,
  );
  for (const hostileSpec of [
    "git@github.com:owner/repo.git",
    "~/hostile",
    "vendor/deep/hostile",
    "$foo/bar",
  ]) {
    assert.throws(
      () => policyModule.validateStaticInstallPolicy({
        ...staticPolicy,
        packageJson: {
          ...packageJson,
          dependencies: {
            ...((packageJson as { dependencies?: object }).dependencies ?? {}),
            hostile: hostileSpec,
          },
        },
      }),
      /unreviewed non-registry dependency source/,
      hostileSpec,
    );
  }
  assert.throws(
    () => policyModule.validateStaticInstallPolicy({
      ...staticPolicy,
      packageJson: {
        ...packageJson,
        dependencies: {
          ...((packageJson as { dependencies?: object }).dependencies ?? {}),
          hostile: { nested: "1.0.0" },
        },
      },
    }),
    /dependencies must remain a string-valued dependency map/,
  );
  assert.throws(
    () => policyModule.validateStaticInstallPolicy({
      ...staticPolicy,
      packageJson: {
        ...packageJson,
        overrides: {
          ...((packageJson as { overrides?: object }).overrides ?? {}),
          hostile: 123,
        },
      },
    }),
    /overrides must remain a plain object with string leaves/,
  );
  assert.throws(
    () => policyModule.validateStaticInstallPolicy({
      ...staticPolicy,
      packageJson: {
        ...packageJson,
        peerDependencies: { hostile: "git+https://example.invalid/hostile.git" },
      },
    }),
    /unreviewed non-registry dependency source/,
  );
  assert.throws(
    () => policyModule.validateStaticInstallPolicy({
      ...staticPolicy,
      packageJson: {
        ...packageJson,
        dependencies: {
          ...((packageJson as { dependencies?: object }).dependencies ?? {}),
          hostile: "example/hostile",
        },
      },
    }),
    /unreviewed non-registry dependency source/,
  );
  assert.throws(
    () => policyModule.validateStaticInstallPolicy({
      ...staticPolicy,
      packageJson: {
        ...packageJson,
        dependencies: {
          ...((packageJson as { dependencies?: object }).dependencies ?? {}),
          hostile: "gitlab:example/hostile",
        },
      },
    }),
    /unreviewed non-registry dependency source/,
  );
  assert.throws(
    () => policyModule.validateStaticInstallPolicy({
      ...staticPolicy,
      packageLock: {
        ...packageLock,
        packages: {
          ...packageLock.packages,
          "node_modules/@esbuild/linux-x64": {
            ...packageLock.packages?.["node_modules/@esbuild/linux-x64"],
            integrity: "sha512-Elp+iwUx5rN5+Y8xLt5/GRoG20WGoDCQ/1Fb+1LiGtvwbDavuSk0jhD/eZdckHAuzcDzccnkv+rEjyWfRx18gg==",
          },
        },
      },
    }),
    /deployment esbuild binary integrity changed/,
  );
  assert.throws(
    () => policyModule.validateStaticInstallPolicy({
      ...staticPolicy,
      packageLock: {
        ...packageLock,
        packages: {
          ...packageLock.packages,
          "node_modules/@adobe/css-tools": {
            ...packageLock.packages?.["node_modules/@adobe/css-tools"],
            resolved: undefined,
            integrity: undefined,
          },
        },
      },
    }),
    /requires an npmjs URL and SHA-512 integrity/,
  );
  assert.throws(
    () => policyModule.validateStaticInstallPolicy({
      ...staticPolicy,
      packageLock: {
        ...packageLock,
        packages: {
          ...packageLock.packages,
          "node_modules/client-only": {
            ...packageLock.packages?.["node_modules/client-only"],
            name: "legacy-javascript",
            version: packageLock.packages?.["node_modules/legacy-javascript"]?.version,
            resolved: packageLock.packages?.["node_modules/legacy-javascript"]?.resolved,
            integrity: packageLock.packages?.["node_modules/legacy-javascript"]?.integrity,
          },
        },
      },
    }),
    /registry alias inventory changed/,
  );
  assert.throws(
    () => policyModule.validateStaticInstallPolicy({
      ...staticPolicy,
      packageLock: {
        ...packageLock,
        packages: {
          ...packageLock.packages,
          "node_modules/@adobe/css-tools": {
            ...packageLock.packages?.["node_modules/@adobe/css-tools"],
            integrity: "sha512-hostile",
          },
        },
      },
    }),
    /requires an npmjs URL and SHA-512 integrity/,
  );
  assert.throws(
    () => policyModule.validateEffectiveNpmConfig({
      npmVersionText: "11.16.0",
      config: {
        allowGit: "all",
        ignoreScripts: "true",
        omitLockfileRegistryResolved: "false",
      },
    }),
    /effective allow-git must be none/,
  );
  assert.throws(
    () => policyModule.validateEffectiveNpmConfig({
      npmVersionText: "12.0.0",
      config: {
        allowGit: "none",
        ignoreScripts: "true",
        omitLockfileRegistryResolved: "false",
      },
    }),
    /through 11\.x/,
  );
  assert.throws(
    () => policyModule.validateEffectiveNpmConfig({
      npmVersionText: "11.17.0",
      githubActions: true,
      config: {
        allowGit: "none",
        ignoreScripts: "true",
        omitLockfileRegistryResolved: "false",
      },
    }),
    /GitHub Actions requires exact npm 11\.16\.0/,
  );
  assert.doesNotThrow(
    () => policyModule.validateEffectiveNpmConfig({
      npmVersionText: "11.16.0",
      githubActions: true,
      config: {
        allowGit: "none",
        ignoreScripts: "true",
        omitLockfileRegistryResolved: "false",
      },
    }),
  );

  const controlledEnvironment = policyModule.buildControlledInstallEnvironment({
    PATH: "/safe/bin",
    CI: "true",
    GITHUB_ACTIONS: "true",
    RUNNER_OS: "Linux",
    RUNNER_ARCH: "X64",
    HTTPS_PROXY: "https://proxy.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-supabase-secret",
    ADMIN_PREVIEW_SESSION_COOKIE: "synthetic-admin-secret",
    APPLE_WALLET_PRIVATE_KEY_BASE64: "synthetic-wallet-secret",
    GITHUB_TOKEN: "synthetic-github-secret",
    NODE_AUTH_TOKEN: "synthetic-registry-secret",
    NODE_OPTIONS: "--require synthetic-secret-module",
    NPM_CONFIG_ALLOW_GIT: "all",
    NPM_CONFIG_DANGEROUSLY_ALLOW_ALL_SCRIPTS: "true",
    VERCEL_SYNTHETIC_SECRET: "synthetic-vercel-secret",
  });
  assert.notEqual(controlledEnvironment.PATH, "/safe/bin");
  assert.equal(controlledEnvironment.PATH, dirname(process.execPath));
  assert.equal(controlledEnvironment.CI, "true");
  assert.equal(controlledEnvironment.GITHUB_ACTIONS, "true");
  assert.equal(controlledEnvironment.RUNNER_OS, "Linux");
  assert.equal(controlledEnvironment.RUNNER_ARCH, "X64");
  assert.equal(controlledEnvironment.HOME, undefined);
  assert.match(controlledEnvironment.NPM_CONFIG_CACHE, /\.tmp[/\\]install-state[/\\]cache$/);
  assert.match(
    controlledEnvironment.NPM_CONFIG_GLOBALCONFIG,
    /\.tmp[/\\]install-state[/\\]global\.npmrc$/,
  );
  assert.match(controlledEnvironment.NPM_CONFIG_USERCONFIG, /\.npmrc$/);
  assert.equal(controlledEnvironment.NPM_CONFIG_ALLOW_GIT, "none");
  assert.equal(controlledEnvironment.NPM_CONFIG_IGNORE_SCRIPTS, "true");
  assert.equal(controlledEnvironment.NPM_CONFIG_OMIT_LOCKFILE_REGISTRY_RESOLVED, "false");
  assert.equal(controlledEnvironment.NPM_CONFIG_STRICT_ALLOW_SCRIPTS, undefined);
  assert.equal(controlledEnvironment.NPM_CONFIG_DANGEROUSLY_ALLOW_ALL_SCRIPTS, undefined);
  assert.equal(controlledEnvironment.NPM_CONFIG_REGISTRY, "https://registry.npmjs.org/");
  for (const secretKey of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "ADMIN_PREVIEW_SESSION_COOKIE",
    "APPLE_WALLET_PRIVATE_KEY_BASE64",
    "GITHUB_TOKEN",
    "NODE_AUTH_TOKEN",
    "NODE_OPTIONS",
    "VERCEL_SYNTHETIC_SECRET",
  ]) {
    assert.equal(controlledEnvironment[secretKey], undefined, secretKey);
  }
  assert.throws(
    () => policyModule.resolveTrustedNpmCliPath({ npm_execpath: "relative/npm-cli.js" }),
    /launched through npm run/,
  );
});

test("every Actions dependency install uses the trusted wrapper with pinned Node", () => {
  const workflowDirectory = new URL("../.github/workflows/", import.meta.url);
  const workflowNames = readdirSync(workflowDirectory)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort();

  for (const workflowName of workflowNames) {
    const workflow = readFileSync(new URL(workflowName, workflowDirectory), "utf8");
    assert.deepEqual(
      workflowInstallBoundaryErrors(workflow),
      [],
      `${workflowName}: every npm-executing job requires its own trusted install boundary`,
    );
    for (const checkout of workflow.matchAll(/uses: actions\/checkout@v7([\s\S]*?)(?=\n\s+- name:|$)/g)) {
      assert.match(
        checkout[1] ?? "",
        /persist-credentials:\s*false/,
        `${workflowName}: checkout credentials must not persist into install or later scripts`,
      );
    }
    assert.deepEqual(
      unreviewedWorkflowNpmCommands(workflow),
      [],
      `${workflowName}: unreviewed npm command bypasses the trusted command inventory`,
    );
    assert.doesNotMatch(
      workflow,
      /^env:/m,
      `${workflowName}: workflows must not expose a top-level environment`,
    );
    assert.doesNotMatch(
      workflow,
      /^ {4}env:/m,
      `${workflowName}: dependency jobs must not expose a job-wide environment`,
    );
    for (const nodeVersion of workflow.matchAll(/node-version:\s*([^\s#]+)/g)) {
      assert.equal(nodeVersion[1], "24.18.1", `${workflowName}: Node must be exact`);
    }
  }
});

test("trusted install and secret ordering is enforced independently per job", () => {
  const missingInstall = `jobs:
  first:
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        env:
          NPM_CONFIG_CACHE: \${{ github.workspace }}/.tmp/npm-cache
        with:
          node-version: 24.18.1
      - run: npm run install:trusted
  second:
    steps:
      - run: npm run build`;
  const preinstallSecret = `jobs:
  second:
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        env:
          NPM_CONFIG_CACHE: \${{ github.workspace }}/.tmp/npm-cache
        with:
          node-version: 24.18.1
      - env:
          TOKEN: \${{ secrets.SYNTHETIC }}
        run: test -n "$TOKEN"
      - run: npm run install:trusted
      - run: npm run build`;
  const missingCheckout = `jobs:
  second:
    steps:
      - uses: actions/setup-node@v7
        env:
          NPM_CONFIG_CACHE: \${{ github.workspace }}/.tmp/npm-cache
        with:
          node-version: 24.18.1
      - run: npm run install:trusted
      - run: npm run build`;

  assert.deepEqual(workflowInstallBoundaryErrors(missingInstall), [
    "second:trusted-install-order",
  ]);
  assert.deepEqual(workflowInstallBoundaryErrors(preinstallSecret), [
    "second:preinstall-credential",
  ]);
  assert.deepEqual(workflowInstallBoundaryErrors(missingCheckout), [
    "second:trusted-checkout",
  ]);
});

test("raw workflow dependency install detection rejects command variants", () => {
  for (const command of [
    "- run: npm ci",
    'run: "npm ci"',
    "run: npm --silent ci",
    "run: |\n  npm install --ignore-scripts",
    "run: npx npm install",
    "run: npm ci --ignore-scripts",
    "run: npm i",
    "run: npm instal",
    "run: npm it",
    "run: npm cit",
    "run: npm sit",
    "run: npm add zod",
    "run: npm ic",
    "run: npm installTest",
    "run: npm installCiTest",
    "run: npm cleanInstall",
    "run: npm cleanInstallTest",
    "run: npm installClean",
    "run: npm isntallClean",
    "run: npm install-t",
    "run: npm install-ci-t",
    "run: npm install-cl",
    "run: npm clean-install-t",
    "run: npm isntall-cle",
  ]) {
    assert.deepEqual(unreviewedWorkflowNpmCommands(command), [
      workflowRunBodies(command)[0],
    ], command);
  }
  assert.deepEqual(
    unreviewedWorkflowNpmCommands("run: npm run install:trusted"),
    [],
  );
  assert.deepEqual(
    unreviewedWorkflowNpmCommands("run: npx playwright install chromium"),
    [],
  );
});

test("secret-bearing Actions keep credentials out of dependency installation", () => {
  const previewSync = read(".github/workflows/preview-sync.yml");
  const adminPerformance = read(".github/workflows/admin-performance.yml");

  assert.doesNotMatch(previewSync, /timeout-minutes: 120\s*\n\s+env:/);
  assert.match(
    previewSync,
    /name: Check preview database connection[\s\S]+?env:\s*\n\s+SUPABASE_PREVIEW_DB_URL:[\s\S]+?run: node scripts\/supabase-sync-preview\.mjs --check-only/,
  );
  assert.match(
    previewSync,
    /name: Sync production data and storage to preview[\s\S]+?env:\s*\n\s+SUPABASE_PRODUCTION_DB_URL:[\s\S]+?SUPABASE_PREVIEW_SERVICE_ROLE_KEY:[\s\S]+?run: npm run sync:preview/,
  );
  assert.doesNotMatch(adminPerformance, /timeout-minutes: 20\s*\n\s+env:/);
  assert.match(
    adminPerformance,
    /name: Measure Preview administrator performance[\s\S]+?env:\s*\n\s+SUPABASE_PREVIEW_URL:[\s\S]+?ADMIN_PREVIEW_LOGIN_PASSWORD:[\s\S]+?run: npm run measure:admin:preview/,
  );
});

test("the failure ledger records a paginated retained-run census", () => {
  const ledger = read(ledgerPath);
  const retainedAudit = read(retainedAuditPath);

  assert.match(ledger, /Fully paginated retained inventory: 3,362 runs/);
  assert.match(ledger, /2,337 success, 195 failure, 136 cancelled, 694 skipped/);
  assert.match(ledger, /all 331 runs classified/);
  assert.match(ledger, /1,755 full logs available and scanned, 582 returned `410 Gone`/);
  assert.match(ledger, /441 successful retained runs/);
  assert.match(ledger, /A blocking abnormal run extends this file before another attempt/);
  assert.match(ledger, /Change-aware tiered CI policy/);
  assert.doesNotMatch(ledger, /audit in progress|pending final census|Do not treat this draft/i);

  assert.match(retainedAudit, /Runs: 3,362 = 2,337 success \+ 195 failure \+ 136 cancelled \+ 694 skipped/);
  assert.match(retainedAudit, /Exact hidden Playwright retry\/flaky IDs \(441\)/);
  assert.match(retainedAudit, /preview_sync_workflow_run_concurrency_cancel` \(51\)/);
  assert.match(retainedAudit, /public_e2e_regression_or_flake_exhausted` \(54\)/);
});

test("the ledger retains post-merge Preview Sync recovery and privacy evidence", () => {
  const ledger = read(ledgerPath);

  assert.match(ledger, /31770526425/);
  assert.match(ledger, /`storage_retry` once at fixed line 963/);
  assert.match(ledger, /`preview_member_identifier_log`[\s\S]+fixed line 957/);
  assert.match(ledger, /712\/712 credential-material removals/);
  assert.match(ledger, /168 migrations, 84 replaced tables, seven Storage buckets/);
});

test("project guidance makes the Actions skill mandatory", () => {
  const agents = read("AGENTS.md");
  const patterns = read(".agents/skills/ssartnership-patterns/SKILL.md");

  assert.match(agents, /`github-actions-operations`: mandatory before any operation/);
  assert.match(patterns, /Before any push, PR open\/update\/ready transition, merge, release, tag/);
  assert.match(patterns, /Repository-controlled failures, hidden retries, security failures, and schema failures block the next trigger/);
  assert.match(patterns, /recovered external-provider transient with proven final parity does not require a source change or a new SHA/);
});

test("the run auditor is read-only, persists no GitHub text, and exposes help", () => {
  const script = read(scriptPath);

  assert.doesNotMatch(script, /gh\(\[[\s\S]*(?:rerun|cancel|delete|workflow run)/);
  assert.doesNotMatch(script, /function sanitize|export function sanitize/);
  assert.doesNotMatch(script, /title:\s*annotation\?\.|message:\s*annotation\?\.|path:\s*annotation\?\./);
  assert.match(script, /check-runs\/\$\{job\.databaseId\}\/annotations/);
  assert.match(script, /hidden_retry/);
  assert.match(script, /typecheck_retry/);
  assert.match(script, /test_failure/);
  assert.match(script, /testing_library/);
  assert.match(script, /storage_retry/);
  assert.match(script, /preview_member_identifier_log/);
  assert.match(script, /storage_skip/);
  assert.match(script, /database_fallback/);
  assert.match(script, /successWithFailedJobs/);
  assert.match(script, /logAvailable/);
  assert.match(script, /annotationCollectionComplete/);
  assert.match(script, /failed_attempt_marker/);
  assert.match(script, /firstLineNumbers/);
  assert.match(script, /never persists GitHub-provided log, annotation, workflow, job, step, or path text/);

  const help = execFileSync(process.execPath, [fileURLToPath(new URL(`../${scriptPath}`, import.meta.url)), "--help"], {
    encoding: "utf8",
  });
  assert.match(help, /--repo OWNER\/REPO --run-id ID --attempt N/);
  assert.match(script, /actions\/runs\/\$\{runId\}\/attempts\/\$\{attempt\}/);
  assert.match(script, /GitHub returned metadata for a different run attempt/);
  assert.match(script, /GitHub returned metadata for a different run ID/);
  assert.match(script, /failed safely; no raw provider output was emitted/);
});

test("the run auditor emits structural evidence for hostile text and confines output", async () => {
  const auditor = await import(new URL(`../${scriptPath}`, import.meta.url).href) as {
    buildSafeReport: (input: {
      repository: string;
      runId: string;
      attempt: number;
      metadata: unknown;
      rawAnnotations: unknown[];
      annotationQueries: unknown[];
      log: string | null;
      auditedAt: string;
    }) => unknown;
    resolveSafeOutputPath: (output: string, cwd?: string) => {
      auditRoot: string;
      target: string;
    };
    writeAuditFile: (output: string, serialized: string, cwd?: string) => void;
  };

  const hostileValues = [
    "SYNTHETIC_PRIVATE_KEY_VALUE",
    "SYNTHETIC_MM_DECRYPTION_KEY",
    "SYNTHETIC_ADMIN_COOKIE",
    "SYNTHETIC_JSON_AUTHORIZATION",
    "SYNTHETIC_WORKFLOW_NAME",
    "SYNTHETIC_JOB_NAME",
    "SYNTHETIC_STEP_NAME",
    "private/member/avatar.png",
  ];
  const report = auditor.buildSafeReport({
    repository: "Owner/Repo",
    runId: "12345",
    attempt: 1,
    auditedAt: "2026-08-13T14:48:40Z",
    metadata: {
      databaseId: 12345,
      workflowName: hostileValues[4],
      event: "push",
      status: "completed",
      conclusion: "success",
      attempt: 1,
      headSha: "0123456789abcdef0123456789abcdef01234567",
      createdAt: "2026-08-13T14:00:00Z",
      updatedAt: "2026-08-13T14:01:00Z",
      jobs: [{
        databaseId: 99,
        name: hostileValues[5],
        status: "completed",
        conclusion: "failure",
        steps: [{
          number: 1,
          name: hostileValues[6],
          status: "completed",
          conclusion: "failure",
        }],
      }],
    },
    rawAnnotations: [{
      jobIndex: 0,
      jobDatabaseId: 99,
      annotation: {
        annotation_level: "failure",
        title: `APPLE_WALLET_PRIVATE_KEY_BASE64=${hostileValues[0]}`,
        message: `##[error] {"Authorization":"ApiKey ${hostileValues[3]}"}`,
        path: hostileValues[7],
        start_line: 7,
        end_line: 7,
      },
    }],
    annotationQueries: [{ jobIndex: 0, jobDatabaseId: 99, available: true }],
    log:
      `##[error] APPLE_WALLET_PRIVATE_KEY_BASE64=${hostileValues[0]}\n`
      + `MM_SENDER_CREDENTIALS_KEY_V1=${hostileValues[1]}\n`
      + `ADMIN_PREVIEW_SESSION_COOKIE=${hostileValues[2]}\n`
      + "1 flaky \u001b[31mretry\u001b[0m #1\n"
      + "✘ synthetic failed attempt\n",
  });
  const serialized = JSON.stringify(report);
  for (const hostileValue of hostileValues) {
    assert.doesNotMatch(serialized, new RegExp(hostileValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(serialized, /"github_error":\{"count":1,"firstLineNumbers":\[1\]\}/);
  assert.match(serialized, /"hidden_retry":\{"count":1,"firstLineNumbers":\[4\]\}/);
  assert.match(serialized, /"failed_attempt_marker":\{"count":1,"firstLineNumbers":\[5\]\}/);
  assert.match(serialized, /"signatures":\["github_error"\]/);
  assert.match(serialized, /"successWithFailedJobs":true/);
  assert.match(serialized, /"annotationCollectionComplete":true/);
  assert.match(serialized, /"auditComplete":true/);

  assert.deepEqual(
    (auditor as unknown as { signatureNamesForText: (text: string) => string[] })
      .signatureNamesForText(
        "[typecheck-ci] TypeScript 검사에 실패했습니다. 재시도합니다.",
      ),
    ["typecheck_retry"],
  );
  assert.deepEqual(
    (auditor as unknown as { signatureNamesForText: (text: string) => string[] })
      .signatureNamesForText(
        "✔ synthetic test describes a timed out deprecated fallback",
      ),
    [],
  );
  assert.deepEqual(
    (auditor as unknown as { signatureNamesForText: (text: string) => string[] })
      .signatureNamesForText(
        "✔ Storybook and visual baselines remain explicit manual tools",
      ),
    [],
  );
  assert.deepEqual(
    (auditor as unknown as { signatureNamesForText: (text: string) => string[] })
      .signatureNamesForText("Screenshot comparison failed for visual baseline"),
    ["visual_drift"],
  );
  assert.deepEqual(
    (auditor as unknown as { signatureNamesForText: (text: string) => string[] })
      .signatureNamesForText(
        'await dialog.findByText("ready", {}, { timeout: 4000 })',
      ),
    [],
  );
  assert.deepEqual(
    (auditor as unknown as { signatureNamesForText: (text: string) => string[] })
      .signatureNamesForText("Test timeout of 30000ms exceeded."),
    ["timeout"],
  );
  assert.deepEqual(
    (auditor as unknown as { signatureNamesForText: (text: string) => string[] })
      .signatureNamesForText(
        "[vite] (client) [console.error] A component suspended inside an act scope, but the act call was not awaited.",
      ),
    ["storybook_console_error", "storybook_react_act_warning"],
  );
  assert.deepEqual(
    (auditor as unknown as { signatureNamesForText: (text: string) => string[] })
      .signatureNamesForText(
        'Module "crypto" has been externalized for browser compatibility.',
      ),
    ["storybook_browser_externalization"],
  );
  assert.deepEqual(
    (auditor as unknown as { signatureNamesForText: (text: string) => string[] })
      .signatureNamesForText("Fast Refresh had to perform a full reload."),
    ["next_dev_full_reload"],
  );
  assert.deepEqual(
    (auditor as unknown as { signatureNamesForText: (text: string) => string[] })
      .signatureNamesForText("npm warn EBADENGINE Unsupported engine"),
    ["npm_engine_warning"],
  );
  assert.deepEqual(
    (auditor as unknown as { signatureNamesForText: (text: string) => string[] })
      .signatureNamesForText(
        "Seeded preview member credentials for SYNTHETIC_MEMBER.",
      ),
    ["preview_member_identifier_log"],
  );

  assert.throws(
    () => auditor.resolveSafeOutputPath("../outside.json", "/tmp/repo"),
    /must be inside \.tmp\/actions-audit/,
  );
  const safeOutput = auditor.resolveSafeOutputPath(
    ".tmp/actions-audit/run-1.json",
    "/tmp/repo",
  );
  assert.equal(
    relative("/tmp/repo", safeOutput.target),
    join(".tmp", "actions-audit", "run-1.json"),
  );

  const tempRoot = mkdtempSync(join(realpathSync(tmpdir()), "actions-auditor-"));
  const repositoryRoot = join(tempRoot, "repository");
  mkdirSync(repositoryRoot);
  mkdirSync(join(repositoryRoot, ".tmp"));
  auditor.writeAuditFile(
    ".tmp/actions-audit/run-1.json",
    '{"safe":true}\n',
    repositoryRoot,
  );
  const outputPath = join(repositoryRoot, ".tmp/actions-audit/run-1.json");
  const outputStat = statSync(outputPath);
  assert.equal(outputStat.isFile(), true);
  if (process.platform !== "win32") {
    assert.equal(outputStat.mode & 0o777, 0o600);
  }
  assert.throws(
    () => auditor.writeAuditFile(
      ".tmp/actions-audit/run-1.json",
      '{"overwrite":true}\n',
      repositoryRoot,
    ),
    /EEXIST/,
  );

  const symlinkedRepository = join(tempRoot, "symlinked-repository");
  const externalTmp = join(tempRoot, "external-tmp");
  mkdirSync(symlinkedRepository);
  mkdirSync(externalTmp);
  symlinkSync(
    externalTmp,
    join(symlinkedRepository, ".tmp"),
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.throws(
    () => auditor.writeAuditFile(
      ".tmp/actions-audit/run-2.json",
      '{"safe":true}\n',
      symlinkedRepository,
    ),
    /\.tmp must not be a symbolic link/,
  );

  const nestedRepository = join(tempRoot, "nested-repository");
  mkdirSync(nestedRepository);
  assert.throws(
    () => auditor.writeAuditFile(
      ".tmp/actions-audit/nested/run-3.json",
      '{"safe":true}\n',
      nestedRepository,
    ),
    /direct child/,
  );

  const incompleteReport = auditor.buildSafeReport({
    repository: "Owner/Repo",
    runId: "12345",
    attempt: 1,
    auditedAt: "2026-08-13T14:48:40Z",
    metadata: {
      databaseId: 12345,
      event: "push",
      status: "completed",
      conclusion: "failure",
      jobs: [{ databaseId: 99, status: "completed", conclusion: "failure" }],
    },
    rawAnnotations: [],
    annotationQueries: [{ jobIndex: 0, jobDatabaseId: 99, available: false }],
    log: null,
  });
  assert.equal(
    (incompleteReport as { integrity: { annotationCollectionComplete: boolean } })
      .integrity.annotationCollectionComplete,
    false,
  );
  assert.equal(
    (incompleteReport as { integrity: { auditComplete: boolean } })
      .integrity.auditComplete,
    false,
  );

  const nonTerminalReport = auditor.buildSafeReport({
    repository: "Owner/Repo",
    runId: "12345",
    attempt: 1,
    auditedAt: "2026-08-13T14:48:40Z",
    metadata: {
      databaseId: 12345,
      attempt: 1,
      event: "push",
      status: "in_progress",
      conclusion: null,
      jobs: [{ databaseId: 99, status: "in_progress", conclusion: null, steps: [] }],
    },
    rawAnnotations: [],
    annotationQueries: [{ jobIndex: 0, jobDatabaseId: 99, available: true }],
    log: "partial log",
  });
  assert.equal(
    (nonTerminalReport as { integrity: { terminalMetadata: boolean } })
      .integrity.terminalMetadata,
    false,
  );
  assert.equal(
    (nonTerminalReport as { integrity: { auditComplete: boolean } })
      .integrity.auditComplete,
    false,
  );

  const unknownIdentityReport = auditor.buildSafeReport({
    repository: "Owner/Repo",
    runId: "12345",
    attempt: 1,
    auditedAt: "2026-08-13T14:48:40Z",
    metadata: {
      databaseId: 12345,
      attempt: 1,
      event: "pull_request_target",
      status: "completed",
      conclusion: "success",
      headSha: null,
      createdAt: "not-a-timestamp",
      updatedAt: "2026-08-13T14:01:00Z",
      jobs: [],
    },
    rawAnnotations: [],
    annotationQueries: [],
    log: "complete log",
  });
  assert.equal(
    (unknownIdentityReport as { integrity: { identityMetadataComplete: boolean } })
      .integrity.identityMetadataComplete,
    false,
  );
  assert.equal(
    (unknownIdentityReport as { integrity: { auditComplete: boolean } })
      .integrity.auditComplete,
    false,
  );

  const mismatchedIdentityReport = auditor.buildSafeReport({
    repository: "Owner/Repo",
    runId: "12345",
    attempt: 1,
    auditedAt: "2026-08-13T14:48:40Z",
    metadata: {
      databaseId: 99999,
      attempt: 2,
      event: "push",
      status: "completed",
      conclusion: "success",
      headSha: "0123456789abcdef0123456789abcdef01234567",
      createdAt: "2026-08-13T14:00:00Z",
      updatedAt: "2026-08-13T14:01:00Z",
      jobs: [],
    },
    rawAnnotations: [],
    annotationQueries: [],
    log: "complete log",
  });
  assert.equal(
    (mismatchedIdentityReport as { integrity: { identityMetadataComplete: boolean } })
      .integrity.identityMetadataComplete,
    false,
  );
  assert.equal(
    (mismatchedIdentityReport as { integrity: { auditComplete: boolean } })
      .integrity.auditComplete,
    false,
  );
});
