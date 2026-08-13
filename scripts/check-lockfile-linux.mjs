import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectDir = new URL("..", import.meta.url);
const projectPath = fileURLToPath(projectDir);
const lockfileUrl = new URL("../package-lock.json", import.meta.url);
const before = readFileSync(lockfileUrl, "utf8");
const CANONICAL_NODE_VERSION = "24.18.1";
const CANONICAL_NPM_VERSION = "11.16.0";
const lockfileArgs = [
  "install",
  "--package-lock-only",
  "--ignore-scripts",
  "--no-audit",
  "--no-fund",
];
const isGitHubLinuxRunner =
  process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_OS === "Linux";

function printCommandOutput(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function runCanonicalNpmCheck(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectPath,
    encoding: "utf8",
  });

  if (result.status === 0 && !result.error) {
    return;
  }

  console.error("");
  console.error("[lockfile-linux-check] Failed to regenerate package-lock.json for verification.");
  printCommandOutput(result);
  process.exit(result.status ?? 1);
}

function runPinnedNpmCheck() {
  runCanonicalNpmCheck("npx", [
    "--yes",
    `npm@${CANONICAL_NPM_VERSION}`,
    ...lockfileArgs,
  ]);
}

function readCommandVersion(command) {
  const result = spawnSync(command, ["--version"], {
    cwd: projectPath,
    encoding: "utf8",
  });

  if (result.status !== 0 || result.error) {
    printCommandOutput(result);
    return null;
  }

  return result.stdout.trim();
}

function isDockerInfrastructureFailure(result) {
  const combinedOutput = [result.error?.message, result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n");

  return (
    result.error?.code === "ENOENT" ||
    combinedOutput.includes("ENOENT") ||
    combinedOutput.includes("docker.sock") ||
    combinedOutput.includes("Cannot connect to the Docker daemon") ||
    combinedOutput.includes("Cannot find the Docker daemon") ||
    combinedOutput.includes("failed to connect to the docker API") ||
    combinedOutput.includes("registry-1.docker.io") ||
    combinedOutput.includes("failed to resolve source metadata") ||
    combinedOutput.includes("TLS handshake timeout") ||
    combinedOutput.includes("i/o timeout") ||
    combinedOutput.includes("502 Bad Gateway")
  );
}

if (isGitHubLinuxRunner) {
  const currentNpmVersion = readCommandVersion("npm");
  if (currentNpmVersion !== CANONICAL_NPM_VERSION) {
    console.error("");
    console.error(
      `[lockfile-linux-check] Expected bundled npm ${CANONICAL_NPM_VERSION}, received ${currentNpmVersion ?? "unavailable"}.`,
    );
    process.exit(1);
  }

  console.log(
    `[lockfile-linux-check] Using pinned Node ${CANONICAL_NODE_VERSION} and bundled npm ${CANONICAL_NPM_VERSION} on the GitHub Linux runner.`,
  );
  runCanonicalNpmCheck("npm", lockfileArgs);
} else {
  const dockerResult = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "--platform",
      "linux/amd64",
      "-v",
      `${projectPath}:/app`,
      "-w",
      "/app",
      `node:${CANONICAL_NODE_VERSION}`,
      "bash",
      "-lc",
      "npm install --package-lock-only --ignore-scripts --no-audit --no-fund",
    ],
    { cwd: projectPath, encoding: "utf8" },
  );

  if (dockerResult.status !== 0 || dockerResult.error) {
    if (!isDockerInfrastructureFailure(dockerResult)) {
      console.error("");
      console.error(
        "[lockfile-linux-check] Docker started, but canonical lockfile verification failed.",
      );
      printCommandOutput(dockerResult);
      process.exit(dockerResult.status ?? 1);
    }

    console.warn("");
    console.warn(
      `[lockfile-linux-check] Docker verification was unavailable; using npm@${CANONICAL_NPM_VERSION} fallback.`,
    );
    runPinnedNpmCheck();
  }
}

const after = readFileSync(lockfileUrl, "utf8");

if (before !== after) {
  console.error("");
  console.error("[lockfile-linux-check] package-lock.json changed under Linux/amd64 resolution.");
  console.error("[lockfile-linux-check] Run `npm run check:lockfile:linux`, review the diff, and commit package-lock.json.");
  process.exit(1);
}

console.log("[lockfile-linux-check] package-lock.json is canonical for Linux/amd64.");
