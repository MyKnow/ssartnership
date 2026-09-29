#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertBuildEnvironment, buildEnvironmentIdentity, loadEnvironmentProfile, nextProcessEnvironment } from "./lib/project-environment.mjs";
import { repositoryRoot } from "./lib/development-environment.mjs";

const [command, ...args] = process.argv.slice(2);
if (!["build", "start"].includes(command)) throw new Error("NEXT_COMMAND_INVALID");
let selected;
try { selected = loadEnvironmentProfile({ root: repositoryRoot, command }); }
catch (error) { process.stderr.write(`${error.message}\n`); process.exit(1); }
const identityFile = join(repositoryRoot, selected.values.NEXT_DIST_DIR || ".next", "ssartnership-environment.json");
if (command === "start" && selected.profile !== "injected") {
  try {
    let source = "";
    try { source = readFileSync(identityFile, "utf8"); } catch { /* Fail closed below. */ }
    assertBuildEnvironment(selected, source);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exit(1); }
}
process.stdout.write(`[environment] ${command}: ${selected.loadedFiles[0] ?? "injected"}\n`);
const child = spawn(process.execPath, [
  fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)),
  command, ...(command === "build" ? ["--webpack"] : []), ...args,
], { cwd: repositoryRoot, env: nextProcessEnvironment(selected.values), stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.once("error", () => { process.stderr.write("NEXT_PROCESS_FAILED\n"); process.exitCode = 1; });
child.once("exit", (code) => {
  if (code === 0 && command === "build" && selected.profile !== "injected") {
    writeFileSync(identityFile, `${JSON.stringify(buildEnvironmentIdentity(selected))}\n`, { mode: 0o600 });
  }
  process.exitCode = code ?? 1;
});
