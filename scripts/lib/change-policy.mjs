import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { repositoryRoot } from "./development-environment.mjs";

export const CHANGE_LEVELS = Object.freeze([
  "docs",
  "development",
  "ui",
  "standard",
  "high",
]);

const LEVEL_RANK = new Map(CHANGE_LEVELS.map((level, index) => [level, index]));
const LINTABLE_EXTENSION = /\.(?:cjs|js|jsx|mjs|mts|ts|tsx)$/u;
const STORY_FILE = /(?:^|\/)\.?[^/]+\.stories\.(?:js|jsx|ts|tsx)$/u;
const UI_CONTRACT_TEST =
  /(?:ui|responsive|layout|component|public-canonical-story|storybook|visual)[^/]*\.test\.(?:mts|ts)$/u;

const EXACT_HIGH_RISK_PATHS = new Set([
  ".gitattributes",
  ".node-version",
  ".npmrc",
  "eslint.config.mjs",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "playwright.config.ts",
  "playwright.visual.config.ts",
  "src/middleware.ts",
  "src/proxy.ts",
  "tsconfig.json",
  "tsconfig.typecheck.json",
  "vercel.json",
  "vitest.config.ts",
]);

const EXACT_HIGH_RISK_TESTS = new Set([
  "tests/cross-platform-development-contract.test.mts",
  "tests/development-environment.test.mts",
  "tests/github-actions-operations-skill.test.mts",
  "tests/prepush-e2e-gate.test.mts",
  "tests/public-readiness.test.mts",
]);

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (!allowFailure && (result.status !== 0 || result.error)) {
    throw new Error("변경 범위를 확인할 수 없습니다.");
  }
  return result;
}

function isGitRevision(revision) {
  if (!revision) return false;
  return runGit(["rev-parse", "--verify", `${revision}^{commit}`], {
    allowFailure: true,
  }).status === 0;
}

function resolveLocalBase(explicitBase) {
  const candidates = [
    explicitBase,
    process.env.CHANGE_BASE,
    "origin/dev",
    "origin/main",
    "HEAD^",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!isGitRevision(candidate)) continue;
    const mergeBase = runGit(["merge-base", "HEAD", candidate], {
      allowFailure: true,
    });
    if (mergeBase.status === 0 && /^[0-9a-f]{40}$/u.test(mergeBase.stdout.trim())) {
      return mergeBase.stdout.trim();
    }
  }

  throw new Error("비교 기준 커밋을 안전하게 결정할 수 없습니다.");
}

export function normalizeRepositoryPath(input) {
  if (typeof input !== "string" || input.length === 0 || /[\0\r\n]/u.test(input)) {
    return null;
  }

  const normalized = input.replaceAll("\\", "/").replace(/^\.\//u, "");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//u.test(normalized) ||
    normalized.split("/").some((segment) => segment === ".." || segment === "")
  ) {
    return null;
  }
  return normalized;
}

export function parseNameStatusZ(output) {
  const fields = output.split("\0");
  if (fields.at(-1) === "") fields.pop();
  const changes = [];

  for (let index = 0; index < fields.length; ) {
    const status = fields[index++];
    if (!status) throw new Error("Git 변경 상태가 비어 있습니다.");
    const kind = status[0];

    if (kind === "R" || kind === "C") {
      const oldPath = fields[index++];
      const path = fields[index++];
      if (oldPath === undefined || path === undefined) {
        throw new Error("Git 이름 변경 정보가 불완전합니다.");
      }
      changes.push({ status, oldPath, path });
      continue;
    }

    const path = fields[index++];
    if (path === undefined) throw new Error("Git 변경 경로가 불완전합니다.");
    changes.push({ status, path });
  }

  return changes;
}

function collectUntrackedChanges() {
  const result = runGit(["ls-files", "--others", "--exclude-standard", "-z"]);
  return result.stdout
    .split("\0")
    .filter(Boolean)
    .map((path) => ({ status: "A", path }));
}

export function collectGitChanges({ base, head, includeWorkingTree = false } = {}) {
  if (includeWorkingTree) {
    const resolvedBase = resolveLocalBase(base);
    const diff = runGit([
      "diff",
      "--name-status",
      "-z",
      "--find-renames=50%",
      resolvedBase,
      "--",
    ]);
    const tracked = parseNameStatusZ(diff.stdout);
    const trackedPaths = new Set(tracked.map((change) => change.path));
    const untracked = collectUntrackedChanges().filter(
      (change) => !trackedPaths.has(change.path),
    );
    return { base: resolvedBase, head: "WORKTREE", changes: [...tracked, ...untracked] };
  }

  if (!base || !head || !isGitRevision(base) || !isGitRevision(head)) {
    throw new Error("원격 CI 비교 커밋이 유효하지 않습니다.");
  }
  const diff = runGit([
    "diff",
    "--name-status",
    "-z",
    "--find-renames=50%",
    `${base}...${head}`,
    "--",
  ]);
  return { base, head, changes: parseNameStatusZ(diff.stdout) };
}

function classifyPath(path) {
  if (
    path.startsWith(".storybook/") ||
    path.startsWith("tests/visual/") ||
    STORY_FILE.test(path) ||
    /(?:^|\/)__snapshots__\//u.test(path)
  ) {
    return "development";
  }

  if (
    EXACT_HIGH_RISK_PATHS.has(path) ||
    EXACT_HIGH_RISK_TESTS.has(path) ||
    path.startsWith(".github/workflows/") ||
    path.startsWith(".github/actions/") ||
    path.startsWith(".agents/skills/github-actions-operations/") ||
    path.startsWith("scripts/") ||
    path.startsWith("supabase/") ||
    path.startsWith("vendor/") ||
    path.startsWith("tests/e2e/") ||
    path.startsWith("src/app/api/") ||
    path.startsWith("src/lib/repositories/") ||
    path.startsWith("src/lib/supabase/") ||
    /(?:^|\/)(?:actions?|middleware|route)\.(?:js|ts|tsx)$/u.test(path) ||
    /(?:^|[./-])(?:auth|authorization|permission|access|credentials?|guards?|gates?|security|session|consent|csrf|rate-limit|wallet|payment|billing)(?:[./-]|$)/iu.test(
      path,
    ) ||
    /(?:password|secret|token)(?:[./-]|$)/iu.test(path)
  ) {
    return "high";
  }

  if (
    path === "AGENTS.md" ||
    path === "LICENSE" ||
    path === "README.md" ||
    path.startsWith("docs/") ||
    path.startsWith(".github/ISSUE_TEMPLATE/") ||
    path === ".github/PULL_REQUEST_TEMPLATE.md" ||
    (path.startsWith(".agents/") && /\.(?:md|txt)$/u.test(path)) ||
    /\.(?:md|mdx|txt)$/u.test(path)
  ) {
    return "docs";
  }

  if (
    path.startsWith("public/") ||
    path === "src/app/globals.css" ||
    path.startsWith("src/components/") ||
    (path.startsWith("src/app/") && /\.(?:css|tsx)$/u.test(path)) ||
    UI_CONTRACT_TEST.test(path)
  ) {
    return "ui";
  }

  if (
    path.startsWith("src/") ||
    path.startsWith("tests/") ||
    path.startsWith("types/")
  ) {
    return "standard";
  }

  return "high";
}

function maxLevel(levels) {
  return levels.reduce((highest, level) =>
    LEVEL_RANK.get(level) > LEVEL_RANK.get(highest) ? level : highest,
  "docs");
}

export function classifyChanges(
  changes,
  { eventName = "local", baseRef = "", forceFull = false } = {},
) {
  if (!Array.isArray(changes)) throw new Error("변경 목록은 배열이어야 합니다.");

  let structuralEscalation = false;
  const normalizedChanges = changes.map((change) => {
    const status = typeof change?.status === "string" ? change.status : "";
    const path = normalizeRepositoryPath(change?.path);
    const oldPath = change?.oldPath
      ? normalizeRepositoryPath(change.oldPath)
      : undefined;
    const kind = status[0];

    if (!path || (change?.oldPath && !oldPath) || !/^[ACDMRTUXB]/u.test(kind)) {
      structuralEscalation = true;
    }
    if (["C", "D", "R", "T", "U", "X", "B"].includes(kind)) {
      structuralEscalation = true;
    }
    return { status, path, oldPath };
  });

  if (normalizedChanges.length === 0 || normalizedChanges.length > 80) {
    structuralEscalation = true;
  }

  const pathLevels = normalizedChanges
    .filter((change) => change.path)
    .map((change) => classifyPath(change.path));
  let level = structuralEscalation
    ? "high"
    : maxLevel(pathLevels.length > 0 ? pathLevels : ["high"]);
  if (forceFull) level = "high";

  return {
    level,
    changeCount: normalizedChanges.length,
    ...deriveExecutionPolicy({ level, eventName, baseRef }),
    structuralEscalation,
  };
}

export function deriveExecutionPolicy({
  level,
  eventName = "local",
  baseRef = "",
}) {
  if (!CHANGE_LEVELS.includes(level)) {
    throw new Error("지원하지 않는 변경 위험 등급입니다.");
  }

  const isPullRequest = eventName === "pull_request";
  const isManual = eventName === "workflow_dispatch";
  const runVerify = level !== "docs";
  const runRelease =
    level === "high" && (isPullRequest || isManual);
  const runSmoke =
    !runRelease &&
    isPullRequest &&
    baseRef === "main" &&
    (level === "ui" || level === "standard");

  return {
    verifyProfile:
      level === "development"
        ? "development"
        : level === "ui"
          ? "ui"
          : level === "docs"
            ? "none"
            : "quick",
    runVerify,
    runSmoke,
    runRelease,
    runJob: runVerify || runSmoke || runRelease,
    requiresVercel: true,
  };
}

export function lintableChangedPaths(changes) {
  const paths = new Set();
  for (const change of changes) {
    if (change.status?.startsWith("D")) continue;
    const path = normalizeRepositoryPath(change.path);
    if (!path || !LINTABLE_EXTENSION.test(path)) continue;
    if (existsSync(resolve(repositoryRoot, path))) paths.add(path);
  }
  return [...paths].sort();
}
