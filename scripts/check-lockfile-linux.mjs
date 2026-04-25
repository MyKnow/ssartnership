import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectDir = new URL("..", import.meta.url);
const projectPath = fileURLToPath(projectDir);
const lockfileUrl = new URL("../package-lock.json", import.meta.url);
const before = readFileSync(lockfileUrl, "utf8");

try {
  execFileSync(
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
    {
      stdio: "inherit",
    },
  );
} catch (error) {
  console.error("");
  console.error("[lockfile-linux-check] Failed to run Docker-based Linux lockfile verification.");
  console.error("[lockfile-linux-check] Ensure Docker Desktop is running and retry.");
  throw error;
}

const after = readFileSync(lockfileUrl, "utf8");

if (before !== after) {
  console.error("");
  console.error("[lockfile-linux-check] package-lock.json changed under Linux/amd64 resolution.");
  console.error("[lockfile-linux-check] Run `npm run check:lockfile:linux`, review the diff, and commit package-lock.json.");
  process.exit(1);
}

console.log("[lockfile-linux-check] package-lock.json is canonical for Linux/amd64.");
