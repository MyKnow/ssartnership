#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const REQUIRED_ENV = [
  "SSARTNERSHIP_VERCEL_TOKEN",
  "SSARTNERSHIP_VERCEL_ORG_ID",
  "SSARTNERSHIP_VERCEL_PROJECT_ID",
];

const BLOCKED_ARGS = new Set(["link", "project"]);
const BLOCKED_FLAGS = new Set(["--token", "-t", "--scope", "-S"]);
const ENV_FILES = [".env", ".env.local", ".env.development.local"];
const VERCEL_CLI_PACKAGE = "vercel@54.14.2";

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) return null;

  let value = match[2].trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [match[1], value];
}

function loadLocalEnvFiles() {
  for (const filePath of ENV_FILES) {
    if (!existsSync(filePath)) continue;
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      const [key, value] = parsed;
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function fail(message) {
  console.error(`[vercel-ssartnership] ${message}`);
  process.exit(1);
}

loadLocalEnvFiles();

const args = process.argv.slice(2);
if (args.length === 0) {
  fail(
    "usage: node scripts/vercel-ssartnership.mjs <vercel args>. Example: node scripts/vercel-ssartnership.mjs env ls production",
  );
}

for (const arg of args) {
  if (BLOCKED_ARGS.has(arg)) {
    fail(
      `"vercel ${arg}" is blocked here. Set project IDs in env and run project-scoped commands instead.`,
    );
  }
  if (BLOCKED_FLAGS.has(arg)) {
    fail(
      `${arg} is blocked here. Use SSARTNERSHIP_VERCEL_* env vars so this repo never falls back to a global Vercel account.`,
    );
  }
}

const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  fail(
    `missing ${missing.join(", ")}. Store the ssartnership account token and project IDs in a gitignored env file.`,
  );
}

const childEnv = {
  ...process.env,
  VERCEL_ORG_ID: process.env.SSARTNERSHIP_VERCEL_ORG_ID,
  VERCEL_PROJECT_ID: process.env.SSARTNERSHIP_VERCEL_PROJECT_ID,
};

const result = spawnSync(
  "npx",
  ["--yes", VERCEL_CLI_PACKAGE, ...args, "--token", process.env.SSARTNERSHIP_VERCEL_TOKEN],
  {
    env: childEnv,
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
