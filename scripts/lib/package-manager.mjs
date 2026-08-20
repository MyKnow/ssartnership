import { spawnSync } from "node:child_process";

import {
  repositoryRoot,
  resolveNpmCliPath,
} from "./development-environment.mjs";

export function runNpmArguments(args, options = {}) {
  const npmCliPath = resolveNpmCliPath(options.env || process.env);
  if (!npmCliPath) {
    throw new Error(
      "npm 실행 경로를 확인할 수 없습니다. npm run을 통해 명령을 실행하세요.",
    );
  }

  return spawnSync(process.execPath, [npmCliPath, ...args], {
    cwd: repositoryRoot,
    env: options.env || process.env,
    stdio: options.stdio || "inherit",
    encoding: options.encoding,
  });
}

export function runPackageScript(name, forwardedArgs = [], options = {}) {
  return runNpmArguments(["run", name, ...(forwardedArgs.length > 0 ? ["--", ...forwardedArgs] : [])], options);
}

export function requireSuccessfulResult(result, label) {
  if (result.error) {
    throw new Error(`${label} 실행에 실패했습니다: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} 실행이 종료 코드 ${result.status ?? 1}로 실패했습니다.`);
  }
}
