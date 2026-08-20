import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { repositoryRootFromModuleUrl } from "./alias-loader.mjs";
import {
  findCaseInsensitiveCollisions,
  findForbiddenAbsolutePaths,
  findNonPortablePackageScripts,
  validateNativeDependencyMatrix,
} from "../scripts/lib/cross-platform-policy.mjs";

const readRepoFile = (relativePath: string) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("경로 대소문자 충돌과 OS 종속 절대경로를 탐지한다", () => {
  assert.deepEqual(
    findCaseInsensitiveCollisions([
      "src/UserService.ts",
      "src/userservice.ts",
      "src/other.ts",
    ]),
    [["src/UserService.ts", "src/userservice.ts"]],
  );

  const violations = findForbiddenAbsolutePaths([
    { file: "scripts/example.mjs", source: "const root = '/Users/example/app';" },
    { file: "scripts/windows.mjs", source: String.raw`const root = 'C:\\Users\\example';` },
  ]);
  assert.equal(violations.length, 2);
});

test("package script에서 shell 종속 구문을 차단한다", () => {
  const violations = findNonPortablePackageScripts({
    valid: "node scripts/example.mjs",
    chained: "npm run lint && npm test",
    posixEnv: "CI=1 node scripts/example.mjs",
    shell: "bash scripts/release.sh",
  });

  assert.deepEqual(
    violations.map((item) => item.name),
    ["chained", "posixEnv", "shell"],
  );
});

test("lockfile이 Windows x64와 macOS arm64 native package를 포함한다", async () => {
  const lockfile = JSON.parse(await readRepoFile("package-lock.json"));
  assert.deepEqual(validateNativeDependencyMatrix(lockfile), []);
});

test("표준 개발 명령과 교차 플랫폼 정책이 repository contract에 고정된다", async () => {
  const packageJson = JSON.parse(await readRepoFile("package.json")) as {
    packageManager?: string;
    engines?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  const scripts = packageJson.scripts ?? {};

  assert.equal(packageJson.packageManager, "npm@11.16.0");
  assert.equal(packageJson.engines?.node, "24.18.1");
  assert.equal(scripts.bootstrap, "node scripts/bootstrap.mjs");
  assert.equal(scripts.doctor, "node scripts/doctor.mjs");
  assert.equal(scripts.dev, "node scripts/dev.mjs");
  assert.equal(scripts.release, "node scripts/release.mjs");
  assert.equal(
    scripts["install:trusted"],
    "node scripts/install-dependencies.mjs",
  );
  assert.equal(
    scripts["check:cross-platform"],
    "node scripts/check-cross-platform.mjs",
  );
  assert.deepEqual(findNonPortablePackageScripts(scripts), []);

  const attributes = await readRepoFile(".gitattributes");
  assert.match(attributes, /^\* text=auto eol=lf$/m);
  assert.match(attributes, /^\*\.bat text eol=crlf$/m);
  assert.match(attributes, /^\*\.cmd text eol=crlf$/m);
});

test("Windows x64와 macOS arm64 CI가 같은 개발환경 명령을 검증한다", async () => {
  const workflow = await readRepoFile(
    ".github/workflows/cross-platform-development.yml",
  );

  assert.match(workflow, /windows-2025/);
  assert.match(workflow, /macos-26/);
  assert.match(workflow, /npm run bootstrap -- --ci/);
  assert.doesNotMatch(workflow, /\bnpm (?:ci|install)\b/);
  assert.match(workflow, /npm run doctor -- --ci/);
  assert.match(workflow, /npm run check:cross-platform/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run typecheck:ci/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
});

test("runtime 도구와 문서에는 사용자 또는 애플리케이션 절대경로가 없다", async () => {
  const files = [
    "README.md",
    "scripts/lighthouse-check.mjs",
    "tests/mm-profile-csv.test.mts",
  ];
  const sources = await Promise.all(
    files.map(async (file) => ({ file, source: await readRepoFile(file) })),
  );

  assert.deepEqual(findForbiddenAbsolutePaths(sources), []);
});

test("trusted installer가 공식 platform binary를 직접 검증한다", async () => {
  const installer = await readRepoFile("scripts/install-dependencies.mjs");
  const policy = await readRepoFile("scripts/check-install-scripts.mjs");

  assert.match(installer, /"darwin-arm64"/);
  assert.match(installer, /"win32-x64"/);
  assert.match(installer, /"linux-x64"/);
  assert.match(installer, /trusted esbuild binary integrity mismatch/);
  assert.doesNotMatch(policy, /\/(?:Users|opt\/homebrew)\//);
  assert.doesNotMatch(policy, /[A-Za-z]:\\\\/);
});

test("Vercel도 shell wrapper 없이 같은 trusted install 경계를 사용한다", async () => {
  const vercel = JSON.parse(await readRepoFile("vercel.json")) as {
    installCommand?: string;
  };

  assert.equal(vercel.installCommand, "npm run install:trusted");
});

test("Node 테스트 로더는 폐기된 비동기 register API를 사용하지 않는다", async () => {
  const registerSource = await readRepoFile("tests/alias-register.mjs");
  const loaderSource = await readRepoFile("tests/alias-loader.mjs");

  assert.match(registerSource, /registerHooks\(\{ resolve \}\)/u);
  assert.doesNotMatch(registerSource, /\bregister\(/u);
  assert.match(loaderSource, /export function resolve\(/u);
  assert.doesNotMatch(loaderSource, /export async function resolve\(/u);
  assert.match(loaderSource, /fileURLToPath\(new URL\("\.\."/u);
  assert.equal(
    repositoryRootFromModuleUrl(
      "file:///D:/a/ssartnership/ssartnership/tests/alias-loader.mjs",
      { windows: true },
    ),
    "D:\\a\\ssartnership\\ssartnership\\",
  );
});

test("테스트 파일 URL과 비교 경로를 운영체제 중립적으로 처리한다", async () => {
  const fileUrlBoundaryFiles = [
    "tests/alias-loader.mjs",
    "tests/auth-session-isolation.test.mts",
    "tests/certification-card-responsive-contract.test.mts",
    "tests/mattermost-direct-reversion.test.mts",
    "tests/mattermost-signup-campus.test.mts",
    "tests/member-normalized-auth-contract.test.mts",
    "tests/production-migration-hygiene.test.mts",
  ];
  const sources = await Promise.all(
    fileUrlBoundaryFiles.map(async (file) => ({
      file,
      source: await readRepoFile(file),
    })),
  );

  for (const { file, source } of sources) {
    assert.doesNotMatch(
      source,
      /new URL\([^\n]*import\.meta\.url[^\n]*\)\.pathname/u,
      `${file} must convert file URLs with fileURLToPath`,
    );
  }

  const terminologyContract = await readRepoFile(
    "tests/terminology-contract.test.mts",
  );
  assert.match(terminologyContract, /\.split\(path\.sep\)\.join\("\/"\)/u);
});

test("Storybook browser 전역 상태와 종료 진단을 명시적으로 정리한다", async () => {
  const packageJson = JSON.parse(await readRepoFile("package.json")) as {
    scripts?: Record<string, string>;
  };
  const setup = await readRepoFile(".storybook/vitest.setup.tsx");

  assert.match(setup, /afterAll\(\(\) => \{/u);
  assert.match(setup, /vi\.unstubAllGlobals\(\)/u);
  assert.match(packageJson.scripts?.["test-storybook"] ?? "", /hanging-process/u);
});
