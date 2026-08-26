#!/usr/bin/env node

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  REQUIRED_NODE_VERSION,
  REQUIRED_NPM_VERSION,
  buildLocalDevelopmentEnv,
  classifyPlatform,
  collectDoctorDiagnostics,
  findUnexpectedProjectEnvironmentFiles,
  loadProjectEnvironment,
  printDiagnostics,
  repositoryRoot,
  serializeEnvFile,
} from "./lib/development-environment.mjs";
import {
  requireSuccessfulResult,
  runNpmArguments,
  runPackageScript,
} from "./lib/package-manager.mjs";

const args = new Set(process.argv.slice(2));
const isCi = args.has("--ci");
const skipInstall = args.has("--skip-install");
const platform = classifyPlatform(process.platform, process.arch);

function fail(message, action) {
  process.stderr.write(`FAIL bootstrap: ${message}\nAction: ${action}\n`);
  process.exit(1);
}

if (platform.support === "unsupported") {
  fail(
    `${platform.label}은 지원되는 개발 플랫폼이 아닙니다.`,
    "Windows x64 또는 macOS arm64를 사용하세요. Linux x64는 CI에서만 지원합니다.",
  );
}

if (process.versions.node !== REQUIRED_NODE_VERSION) {
  fail(
    `Node.js ${REQUIRED_NODE_VERSION}이 필요하지만 ${process.versions.node}이 실행 중입니다.`,
    `저장소에 고정된 Node.js ${REQUIRED_NODE_VERSION}을 활성화하세요.`,
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
    `저장소에 고정된 npm ${REQUIRED_NPM_VERSION}을 활성화하세요.`,
  );
}

process.stdout.write(`PASS Platform: ${platform.label} (${platform.support})\n`);
process.stdout.write(`PASS Runtime: Node.js ${REQUIRED_NODE_VERSION}, npm ${REQUIRED_NPM_VERSION}\n`);

const currentEnvironment = loadProjectEnvironment({ root: repositoryRoot });
const unexpectedEnvironmentFiles = findUnexpectedProjectEnvironmentFiles({
  root: repositoryRoot,
});
if (unexpectedEnvironmentFiles.length > 0) {
  fail(
    `지원하지 않는 환경 파일이 있습니다: ${unexpectedEnvironmentFiles.join(", ")}.`,
    "검토한 값을 .env로 통합하고 추가 환경 파일을 제거하세요.",
  );
}
if (currentEnvironment.loadedFiles.length === 0) {
  const envPath = join(repositoryRoot, ".env");
  if (!existsSync(envPath)) {
    writeFileSync(
      envPath,
      serializeEnvFile(buildLocalDevelopmentEnv()),
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    process.stdout.write(
      "PASS Environment: 로컬 mock 개발용 .env를 생성했습니다. Secret 값은 출력하지 않았습니다.\n",
    );
  }
} else {
  process.stdout.write(
    `PASS Environment: 기존 환경 파일(${currentEnvironment.loadedFiles.join(", ")})을 보존했습니다.\n`,
  );
}

if (skipInstall) {
  process.stdout.write("WARN Dependencies: --skip-install 요청으로 설치를 건너뜁니다.\n");
} else {
  process.stdout.write(
    "Dependency installation: 검증된 무수명주기 install:trusted 경계를 실행합니다.\n",
  );
  const installResult = runPackageScript("install:trusted");
  requireSuccessfulResult(installResult, "dependency installation");
  process.stdout.write("PASS Dependencies: 고정된 lockfile로 설치했습니다.\n");
}

process.stdout.write("PASS Code generation: 별도 초기 code generation이 필요하지 않습니다.\n");
process.stdout.write("PASS Local infrastructure: 기본 mock profile은 container와 local DB를 요구하지 않습니다.\n");

const diagnostics = await collectDoctorDiagnostics({
  root: repositoryRoot,
  checkPort: !isCi,
});
const summary = printDiagnostics(diagnostics);
if (summary.FAIL > 0) {
  process.exit(1);
}

process.stdout.write("bootstrap completed. Next: npm run doctor, then npm run dev\n");
