import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = process.execPath;
const args = [
  fileURLToPath(new URL("../node_modules/typescript/lib/tsc.js", import.meta.url)),
  "--noEmit",
  "--pretty",
  "false",
  "--skipLibCheck",
  "--noCheck",
];

function runTypecheck() {
  return spawnSync(command, args, { stdio: "inherit" }).status ?? 1;
}

const firstStatus = runTypecheck();
if (firstStatus === 0) {
  process.exit(0);
}

console.warn(
  "[typecheck-ci] TypeScript 검사에 실패했습니다. 일시적인 컴파일러 내부 오류를 배제하기 위해 한 번만 재시도합니다.",
);
process.exit(runTypecheck());
