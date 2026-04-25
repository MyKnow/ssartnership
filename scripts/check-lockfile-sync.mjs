import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const before = readFileSync(new URL("../package-lock.json", import.meta.url), "utf8");

execFileSync(
  "npm",
  ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"],
  {
    cwd: new URL("..", import.meta.url),
    stdio: "inherit",
  },
);

const after = readFileSync(new URL("../package-lock.json", import.meta.url), "utf8");

if (before !== after) {
  console.error("");
  console.error("[lockfile-check] package-lock.json was out of sync with package.json.");
  console.error("[lockfile-check] The lockfile has been refreshed locally.");
  console.error("[lockfile-check] Review the changes and commit package-lock.json before pushing.");
  process.exit(1);
}

console.log("[lockfile-check] package-lock.json is in sync.");
