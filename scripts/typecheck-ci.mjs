import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = process.execPath;
const project = fileURLToPath(
  new URL("../tsconfig.typecheck.json", import.meta.url),
);
const args = [
  fileURLToPath(new URL("../node_modules/typescript/lib/tsc.js", import.meta.url)),
  "--project",
  project,
  "--noEmit",
  "--pretty",
  "false",
  "--skipLibCheck",
  "--incremental",
  "false",
];

function runTypecheck() {
  return spawnSync(command, args, { stdio: "inherit" }).status ?? 1;
}

process.exit(runTypecheck());
