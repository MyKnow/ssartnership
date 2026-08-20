#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  collectDoctorDiagnostics,
  printDiagnostics,
  repositoryRoot,
} from "./lib/development-environment.mjs";

const diagnostics = await collectDoctorDiagnostics({ root: repositoryRoot });
const summary = printDiagnostics(diagnostics);
if (summary.FAIL > 0) {
  process.stderr.write("개발 서버를 시작하지 않았습니다. FAIL 항목을 해결한 뒤 npm run dev를 다시 실행하세요.\n");
  process.exit(1);
}

const nextCliPath = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);
const child = spawn(
  process.execPath,
  [nextCliPath, "dev", "--webpack", ...process.argv.slice(2)],
  {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.once("error", (error) => {
  process.stderr.write(`개발 서버를 시작할 수 없습니다: ${error.message}\n`);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
