import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectDir = new URL("..", import.meta.url);
const projectPath = fileURLToPath(projectDir);
const lockfileUrl = new URL("../package-lock.json", import.meta.url);
const before = readFileSync(lockfileUrl, "utf8");

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
    "node:20",
    "bash",
    "-lc",
    "npm install --package-lock-only --ignore-scripts --no-audit --no-fund",
  ],
  { cwd: projectPath, encoding: "utf8" },
);
if (dockerResult.status !== 0 || dockerResult.error) {
  const combinedOutput = [dockerResult.error?.message, dockerResult.stdout, dockerResult.stderr]
    .filter(Boolean)
    .join("\n");
  const dockerUnavailable =
    combinedOutput.includes("docker.sock") ||
    combinedOutput.includes("Cannot connect to the Docker daemon") ||
    combinedOutput.includes("Cannot find the Docker daemon") ||
    combinedOutput.includes("failed to connect to the docker API");
  if (!dockerUnavailable) {
    console.error("");
    console.error("[lockfile-linux-check] Failed to run Docker-based Linux lockfile verification.");
    console.error("[lockfile-linux-check] Ensure Docker Desktop is running and retry.");
    if (dockerResult.stdout) {
      process.stdout.write(dockerResult.stdout);
    }
    if (dockerResult.stderr) {
      process.stderr.write(dockerResult.stderr);
    }
    process.exit(dockerResult.status ?? 1);
  }
  console.warn("");
  console.warn("[lockfile-linux-check] Docker is unavailable, falling back to npm@10 lockfile verification.");
  execFileSync(
    "npx",
    [
      "npm@10",
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    {
      cwd: projectPath,
      stdio: "inherit",
    },
  );
}

const after = readFileSync(lockfileUrl, "utf8");

if (before !== after) {
  console.error("");
  console.error("[lockfile-linux-check] package-lock.json changed under Linux/amd64 resolution.");
  console.error("[lockfile-linux-check] Run `npm run check:lockfile:linux`, review the diff, and commit package-lock.json.");
  process.exit(1);
}

console.log("[lockfile-linux-check] package-lock.json is canonical for Linux/amd64.");
