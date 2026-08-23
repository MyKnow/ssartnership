import assert from "node:assert/strict";
import { win32 as winPath } from "node:path";
import test from "node:test";

import {
  buildLocalDevelopmentEnv,
  classifyPlatform,
  getUnexpectedProjectEnvironmentFiles,
  parseEnvFile,
  resolveNpmCliPath,
  validateEnvironment,
} from "../scripts/lib/development-environment.mjs";

test("공식 개발 플랫폼과 CI 전용 플랫폼을 명시적으로 구분한다", () => {
  assert.deepEqual(classifyPlatform("win32", "x64"), {
    key: "windows-x64",
    label: "Windows x64",
    support: "official",
  });
  assert.deepEqual(classifyPlatform("darwin", "arm64"), {
    key: "macos-arm64",
    label: "macOS arm64",
    support: "official",
  });
  assert.deepEqual(classifyPlatform("linux", "x64"), {
    key: "linux-x64",
    label: "Linux x64",
    support: "ci-only",
  });
  assert.equal(classifyPlatform("win32", "arm64").support, "unsupported");
});

test("CRLF와 따옴표를 포함한 env 파일을 OS와 무관하게 읽는다", () => {
  assert.deepEqual(
    parseEnvFile(
      "# comment\r\nNEXT_PUBLIC_DATA_SOURCE=mock\r\nQUOTED=\"hello world\"\r\nEMPTY=\r\n",
    ),
    {
      NEXT_PUBLIC_DATA_SOURCE: "mock",
      QUOTED: "hello world",
      EMPTY: "",
    },
  );
});

test("프로젝트 루트 환경 파일은 .env와 .env.example만 허용한다", () => {
  assert.deepEqual(
    getUnexpectedProjectEnvironmentFiles([
      ".env",
      ".env.example",
      ".env.local",
      ".env.development",
      ".env.development.local",
      "README.md",
    ]),
    [".env.development", ".env.development.local", ".env.local"],
  );
});

test("npm 실행 경로가 없는 직접 Node 실행에서도 같은 runtime의 npm CLI를 찾는다", () => {
  const npmCliPath = resolveNpmCliPath({} as NodeJS.ProcessEnv);

  assert.ok(npmCliPath);
  assert.match(npmCliPath, /node_modules[\\/]npm[\\/]bin[\\/]npm-cli\.js$/u);
});

test("Windows hosted Node layout에서도 상위 version 디렉터리의 npm CLI를 찾는다", () => {
  const nodeExecutablePath = String.raw`C:\hostedtoolcache\windows\node\24.18.1\x64\node.exe`;
  const expectedNpmCliPath = String.raw`C:\hostedtoolcache\windows\node\24.18.1\node_modules\npm\bin\npm-cli.js`;

  const npmCliPath = resolveNpmCliPath(
    {} as NodeJS.ProcessEnv,
    {
      executablePath: nodeExecutablePath,
      pathModule: winPath,
      exists: (candidate) => candidate === expectedNpmCliPath,
    },
  );

  assert.equal(npmCliPath, expectedNpmCliPath);
});

test("bootstrap용 로컬 환경은 secret을 출력하지 않고 mock profile을 만든다", () => {
  const env = buildLocalDevelopmentEnv(() => "generated-secret-value");

  assert.equal(env.NEXT_PUBLIC_DATA_SOURCE, "mock");
  assert.equal(env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE, "mock");
  assert.equal(env.MOCK_MEMBER_AUTH, "1");
  assert.equal(env.ADMIN_SESSION_SECRET, "generated-secret-value");
});

test("개발 mock profile은 필수 변수와 형식을 함께 검증한다", () => {
  const valid = validateEnvironment({
    NODE_ENV: "development",
    NEXT_PUBLIC_DATA_SOURCE: "mock",
    NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "mock",
    MOCK_MEMBER_AUTH: "1",
  });
  assert.equal(valid.some((item) => item.level === "FAIL"), false);

  const missing = validateEnvironment({
    NODE_ENV: "development",
    NEXT_PUBLIC_DATA_SOURCE: "mock",
    NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "",
  });
  assert.ok(
    missing.some(
      (item) =>
        item.level === "FAIL" &&
        item.code === "environment_required" &&
        item.subject === "NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE",
    ),
  );
});

test("외부 제공자가 정하는 SMTP 비밀번호 길이는 애플리케이션 secret 규칙으로 거부하지 않는다", () => {
  const diagnostics = validateEnvironment({
    NODE_ENV: "development",
    NEXT_PUBLIC_DATA_SOURCE: "mock",
    NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "mock",
    MOCK_MEMBER_AUTH: "1",
    SMTP_PASS: "provider-password",
  });

  assert.equal(
    diagnostics.some(
      (item) =>
        item.code === "environment_secret_too_short" &&
        item.subject === "SMTP_PASS",
    ),
    false,
  );
});

test("Production의 mock 오사용과 잘못된 형식을 차단하되 값을 노출하지 않는다", () => {
  const rawSecret = "short-secret-do-not-print";
  const diagnostics = validateEnvironment({
    NODE_ENV: "production",
    NEXT_PUBLIC_DATA_SOURCE: "mock",
    NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "mock",
    SUPABASE_URL: "not-a-url",
    SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    ADMIN_SESSION_SECRET: rawSecret,
  });

  assert.ok(
    diagnostics.some((item) => item.code === "production_mock_forbidden"),
  );
  assert.ok(diagnostics.some((item) => item.code === "environment_invalid_url"));
  assert.ok(
    diagnostics.some((item) => item.code === "environment_secret_too_short"),
  );
  assert.equal(JSON.stringify(diagnostics).includes(rawSecret), false);
});
