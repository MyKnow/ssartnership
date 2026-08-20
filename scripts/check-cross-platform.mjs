#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

import {
  findCaseInsensitiveCollisions,
  findForbiddenAbsolutePaths,
  findImportCaseViolations,
  findNonPortablePackageScripts,
  validateNativeDependencyMatrix,
} from "./lib/cross-platform-policy.mjs";
import {
  DEPLOYMENT_NODE_VERSION_RANGE,
  REQUIRED_NODE_VERSION,
  repositoryRoot,
} from "./lib/development-environment.mjs";

const failures = [];

function addFailure(code, subject, action) {
  failures.push({ code, subject, action });
}

function gitOutput(args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.status !== 0 || result.error) {
    throw new Error(`git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

const repositoryFiles = gitOutput([
  "ls-files",
  "-z",
  "--cached",
  "--others",
  "--exclude-standard",
])
  .split("\0")
  .filter(Boolean)
  .filter((file) => existsSync(join(repositoryRoot, file)));

for (const collision of findCaseInsensitiveCollisions(repositoryFiles)) {
  addFailure(
    "filename_case_collision",
    collision.join(" <> "),
    "Rename the files so their case-folded repository paths are unique.",
  );
}

const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, "package.json"), "utf8"),
);
for (const violation of findNonPortablePackageScripts(packageJson.scripts || {})) {
  addFailure(
    violation.code,
    `package.json#scripts.${violation.name}`,
    "Move orchestration and environment handling into a Node.js script.",
  );
}

const shellAutomation = repositoryFiles.filter(
  (file) =>
    file.startsWith("scripts/") &&
    [".sh", ".bash", ".zsh", ".bat", ".cmd"].includes(extname(file)),
);
for (const file of shellAutomation) {
  addFailure(
    "shell_automation",
    file,
    "Use a Node.js entrypoint for repository automation. Thin wrappers must live outside the standard package interface.",
  );
}

const absolutePathScanFiles = repositoryFiles.filter(
  (file) =>
    file === "README.md" ||
    file.startsWith("src/") ||
    (file.startsWith("scripts/") &&
      file !== "scripts/lib/cross-platform-policy.mjs" &&
      file !== "scripts/check-cross-platform.mjs"),
);
const absolutePathSources = absolutePathScanFiles
  .filter((file) => existsSync(join(repositoryRoot, file)))
  .map((file) => ({
    file,
    source: readFileSync(join(repositoryRoot, file), "utf8"),
  }));
for (const violation of findForbiddenAbsolutePaths(absolutePathSources)) {
  addFailure(
    violation.code,
    `${violation.file}:${violation.line}`,
    "Resolve paths from the repository, script location, environment, or runtime path API.",
  );
}

for (const violation of findImportCaseViolations({
  root: repositoryRoot,
  trackedFiles: repositoryFiles,
})) {
  addFailure(
    "import_case_mismatch",
    `${violation.file}:${violation.line}`,
    "Match the imported filename casing exactly.",
  );
}

const symlinkEntries = gitOutput(["ls-files", "-s", "-z"])
  .split("\0")
  .filter(Boolean)
  .filter((entry) => entry.startsWith("120000 "))
  .filter((entry) => {
    const tabIndex = entry.indexOf("\t");
    return tabIndex >= 0 && existsSync(join(repositoryRoot, entry.slice(tabIndex + 1)));
  });
for (const entry of symlinkEntries) {
  const tabIndex = entry.indexOf("\t");
  const file = tabIndex >= 0 ? entry.slice(tabIndex + 1) : "tracked symlink";
  addFailure(
    "tracked_symlink",
    file,
    "Replace the required symlink with a repository directory or workspace feature.",
  );
}

const crlfAllowed = (file) => [".bat", ".cmd"].includes(extname(file));
const textExtensions = new Set([
  "",
  ".css",
  ".csv",
  ".html",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mjs",
  ".mts",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
for (const file of repositoryFiles) {
  if (crlfAllowed(file) || !textExtensions.has(extname(file))) {
    continue;
  }
  const buffer = readFileSync(join(repositoryRoot, file));
  if (buffer.includes(Buffer.from("\r\n"))) {
    addFailure(
      "unexpected_crlf",
      file,
      "Normalize the tracked text file to LF; .gitattributes enforces the repository policy.",
    );
  }
}

const attributesPath = join(repositoryRoot, ".gitattributes");
const attributes = existsSync(attributesPath)
  ? readFileSync(attributesPath, "utf8")
  : "";
if (!/^\* text=auto eol=lf$/mu.test(attributes)) {
  addFailure(
    "gitattributes_missing_lf_policy",
    ".gitattributes",
    "Add the repository-wide LF policy.",
  );
}

const lockfile = JSON.parse(
  readFileSync(join(repositoryRoot, "package-lock.json"), "utf8"),
);
for (const violation of validateNativeDependencyMatrix(lockfile)) {
  addFailure(
    "native_dependency_missing",
    violation.platform,
    `Restore ${violation.packagePath} in the canonical lockfile.`,
  );
}

if (packageJson.packageManager !== "npm@11.16.0") {
  addFailure(
    "package_manager_not_pinned",
    "package.json#packageManager",
    "Pin npm@11.16.0 as the development environment source of truth.",
  );
}
if (packageJson.engines?.node !== DEPLOYMENT_NODE_VERSION_RANGE) {
  addFailure(
    "deployment_node_range_invalid",
    "package.json#engines.node",
    `Allow deployment providers to use Node.js ${REQUIRED_NODE_VERSION} through the next major version while keeping local and CI tooling pinned exactly.`,
  );
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(
      `FAIL ${failure.code}: ${failure.subject}. Action: ${failure.action}\n`,
    );
  }
  process.stderr.write(`Summary: ${failures.length} cross-platform violation(s).\n`);
  process.exit(1);
}

process.stdout.write(
  "PASS Cross-platform policy: Windows x64 and macOS arm64 repository contracts are satisfied.\n",
);
