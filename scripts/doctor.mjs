#!/usr/bin/env node

import {
  collectDoctorDiagnostics,
  printDiagnostics,
  repositoryRoot,
} from "./lib/development-environment.mjs";

const args = new Set(process.argv.slice(2));
const diagnostics = await collectDoctorDiagnostics({
  root: repositoryRoot,
  checkPort: !args.has("--ci"),
});
const summary = printDiagnostics(diagnostics);

if (summary.FAIL > 0) {
  process.exit(1);
}
