#!/usr/bin/env node
/**
 * Detects drift between the environment manifest, the keys the application
 * reads, `.env.example` and `deploy/self-host/runtime.env.example`.
 * Prints names only; it never reads real env files or values.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractEnvironmentReads,
  findEnvironmentDrift,
} from "./lib/env-manifest.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_EXTENSIONS = /\.(?:ts|tsx|mts|mjs|js)$/u;
const EXCLUDED_SOURCE = /\.(?:test|stories)\.[cm]?[jt]sx?$/u;

function listSourceFiles(directory) {
  const files = [];
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...listSourceFiles(path));
    else if (SOURCE_EXTENSIONS.test(name) && !EXCLUDED_SOURCE.test(name)) files.push(path);
  }
  return files;
}

/** Collects env keys read by application code (src/ and next.config.ts). */
export function collectApplicationEnvironmentReads(root = repositoryRoot) {
  const reads = new Set();
  const files = [...listSourceFiles(join(root, "src")), join(root, "next.config.ts")];
  for (const file of files) {
    for (const name of extractEnvironmentReads(readFileSync(file, "utf8"))) reads.add(name);
  }
  return reads;
}

/** Reads REAL_REQUIRED_ENV_NAMES from the self-host runtime validator source. */
export function readRealRequiredEnvironmentNames(root = repositoryRoot) {
  const source = readFileSync(join(root, "deploy/self-host/runtime-env.mjs"), "utf8");
  const block = /const REAL_REQUIRED_ENV_NAMES = \[([\s\S]*?)\];/u.exec(source)?.[1];
  if (!block) throw new Error("REAL_REQUIRED_ENV_NAMES를 찾을 수 없습니다.");
  return [...block.matchAll(/"([A-Z][A-Z0-9_]+)"/gu)].map((match) => match[1]);
}

export function checkEnvironment(root = repositoryRoot) {
  return findEnvironmentDrift({
    sourceReads: collectApplicationEnvironmentReads(root),
    envExample: readFileSync(join(root, ".env.example"), "utf8"),
    runtimeExample: readFileSync(join(root, "deploy/self-host/runtime.env.example"), "utf8"),
    realRequiredNames: readRealRequiredEnvironmentNames(root),
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = checkEnvironment();
  if (problems.length > 0) {
    console.error(`환경 변수 매니페스트 drift ${problems.length}건 (${relative(process.cwd(), join(repositoryRoot, "scripts/lib/env-manifest.mjs"))}):`);
    for (const problem of problems) console.error(`- ${problem}`);
    process.exitCode = 1;
  } else {
    console.log("환경 변수 매니페스트·예시 파일·코드 읽기가 일치합니다.");
  }
}
