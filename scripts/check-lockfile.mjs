#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  REQUIRED_NODE_VERSION,
  REQUIRED_NPM_VERSION,
  repositoryRoot,
} from "./lib/development-environment.mjs";
import { runNpmArguments } from "./lib/package-manager.mjs";

function fail(message, action) {
  process.stderr.write(`FAIL lockfile: ${message}\nAction: ${action}\n`);
  process.exit(1);
}

if (process.versions.node !== REQUIRED_NODE_VERSION) {
  fail(
    `Node.js ${REQUIRED_NODE_VERSION}이 필요하지만 ${process.versions.node}이 실행 중입니다.`,
    "저장소에 고정된 runtime을 활성화하고 npm run check:lockfile을 다시 실행하세요.",
  );
}

const npmVersionResult = runNpmArguments(["--version"], {
  stdio: ["ignore", "pipe", "pipe"],
  encoding: "utf8",
});
const npmVersion = npmVersionResult.stdout?.trim();
if (npmVersionResult.status !== 0 || npmVersion !== REQUIRED_NPM_VERSION) {
  fail(
    `npm ${REQUIRED_NPM_VERSION}이 필요하지만 ${npmVersion || "확인 불가"}가 실행 중입니다.`,
    "저장소에 고정된 package manager를 활성화하세요.",
  );
}

const lockfilePath = join(repositoryRoot, "package-lock.json");
const before = readFileSync(lockfilePath, "utf8");
const result = runNpmArguments([
  "install",
  "--package-lock-only",
  "--ignore-scripts",
  "--include=dev",
  "--include=optional",
  "--no-audit",
  "--no-fund",
]);
if (result.status !== 0 || result.error) {
  fail(
    "고정된 npm으로 package-lock.json을 재계산하지 못했습니다.",
    "네트워크와 registry 설정을 확인한 뒤 다시 실행하세요.",
  );
}

const after = readFileSync(lockfilePath, "utf8");
if (before !== after) {
  fail(
    "package-lock.json이 canonical 재계산 과정에서 변경되었습니다.",
    "diff를 검토하고 의도한 lockfile 변경을 커밋한 뒤 다시 실행하세요.",
  );
}

process.stdout.write(
  `PASS lockfile: Node.js ${REQUIRED_NODE_VERSION} / npm ${REQUIRED_NPM_VERSION}에서 canonical합니다.\n`,
);
