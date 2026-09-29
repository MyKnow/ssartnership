import assert from "node:assert/strict";
import { join, win32 as winPath } from "node:path";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { assertBuildEnvironment, buildEnvironmentIdentity, loadEnvironmentProfile, nextProcessEnvironment, selectEnvironmentProfile } from "../scripts/lib/project-environment.mjs";
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

test("Preview/Production 환경 파일만 허용하고 legacy .env를 거부한다", () => {
  assert.deepEqual(
    getUnexpectedProjectEnvironmentFiles([
      ".env",
      ".env.example",
      ".env.preview",
      ".env.production",
      ".env.local",
      ".env.development",
      ".env.development.local",
      "README.md",
    ]),
    [".env", ".env.development", ".env.development.local", ".env.local"],
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

test("dev는 main에서도 Preview, build/start는 main에서만 Production을 선택한다", () => {
  for (const command of ["dev", "doctor", "bootstrap"]) {
    assert.equal(selectEnvironmentProfile({ command, branch: "main", environment: {} }), "preview");
  }
  for (const command of ["build", "start"]) {
    assert.equal(selectEnvironmentProfile({ command, branch: "main", environment: {} }), "production");
    for (const branch of ["dev", "feat/example", "fix/example", "hotfix/example"]) {
      assert.equal(selectEnvironmentProfile({ command, branch, environment: {} }), "preview");
    }
    assert.throws(() => selectEnvironmentProfile({ command, branch: "", environment: {} }), /ENV_BRANCH_REQUIRED/);
  }
});

test("NODE_ENV=production은 데이터 환경을 Production으로 바꾸지 않는다", () => {
  assert.equal(selectEnvironmentProfile({ command: "build", branch: "dev", environment: { NODE_ENV: "production" } }), "preview");
});

test("start는 다른 프로필이나 공개 설정으로 빌드한 산출물을 거부한다", () => {
  const selected = { profile: "preview", values: { NEXT_PUBLIC_SITE_URL: "http://localhost:3000", SERVER_SECRET: "not-persisted" } };
  const source = JSON.stringify(buildEnvironmentIdentity(selected));
  assert.equal(source.includes("not-persisted"), false);
  assert.doesNotThrow(() => assertBuildEnvironment(selected, source));
  assert.throws(() => assertBuildEnvironment({ ...selected, profile: "production" }, source), /ENV_BUILD_PROFILE_MISMATCH/);
  assert.throws(() => assertBuildEnvironment({ ...selected, values: { NEXT_PUBLIC_SITE_URL: "https://example.com" } }, source), /ENV_BUILD_PROFILE_MISMATCH/);
  assert.throws(() => assertBuildEnvironment(selected, ""), /ENV_BUILD_IDENTITY_MISSING/);
});

test("선택한 파일만 읽고, 파일 누락은 기존 .env나 반대 환경으로 대체하지 않는다", (t) => {
  const root = mkdtempSync(join(tmpdir(), "environment-profile-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, ".env"), "OLD_SECRET=legacy\n");
  writeFileSync(join(root, ".env.production"), "PROD_ONLY=production-secret\nSHARED=production\n");
  assert.throws(() => loadEnvironmentProfile({ root, environment: {}, branch: "dev" }), /ENV_PROFILE_MISSING/);
  writeFileSync(join(root, ".env.preview"), 'SHARED=preview\nQUOTED="literal#value$notExpanded"\nEMPTY=\n');
  const preview = loadEnvironmentProfile({ root, environment: {}, branch: "dev" });
  assert.deepEqual(preview.loadedFiles, [".env.preview"]);
  assert.deepEqual(preview.values, { SHARED: "preview", QUOTED: "literal#value$notExpanded", EMPTY: "" });
  const production = loadEnvironmentProfile({ root, environment: {}, command: "build", branch: "main" });
  assert.equal(production.values.PROD_ONLY, "production-secret");
  assert.equal(production.values.OLD_SECRET, undefined);
});

test("배포 주입과 명시적 mock은 로컬 비밀 파일을 읽지 않는다", (t) => {
  const root = mkdtempSync(join(tmpdir(), "environment-injected-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, ".env.production"), "PROD_ONLY=do-not-load\n");
  writeFileSync(join(root, ".env.preview"), "PREVIEW_ONLY=do-not-load\n");
  for (const environment of [
    { CI: "1", NEXT_PUBLIC_DATA_SOURCE: "mock", NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "mock" },
    { SELF_HOST_BUILD: "1", NEXT_PUBLIC_DATA_SOURCE: "supabase", NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "supabase" },
    { VERCEL: "1", NEXT_PUBLIC_DATA_SOURCE: "supabase", NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "supabase" },
    { NEXT_PUBLIC_DATA_SOURCE: "mock", NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "mock" },
  ]) {
    const result = loadEnvironmentProfile({ root, environment, command: "build", branch: "main" });
    assert.equal(result.profile, "injected");
    assert.deepEqual(result.loadedFiles, []);
    assert.deepEqual(result.values, environment);
  }
});

test("Next 최초 로딩과 강제 재로딩 및 자식 프로세스에서 다른 dotenv가 유입되지 않는다", (t) => {
  const root = mkdtempSync(join(tmpdir(), "next-profile-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, ".env.production"), "PROD_ONLY=do-not-load\n");
  writeFileSync(join(root, ".env"), "LEGACY_ONLY=do-not-load\n");
  const environment = nextProcessEnvironment({ ...process.env, PROFILE_SENTINEL: "preview" });
  const source = `
    const assert = require('node:assert/strict');
    const nextEnv = require('@next/env');
    for (const reload of [false, true]) {
      const result = nextEnv.loadEnvConfig(process.argv[1], false, console, reload);
      assert.equal(result.combinedEnv.PROFILE_SENTINEL, 'preview');
      assert.equal(result.combinedEnv.PROD_ONLY, undefined);
      assert.equal(result.combinedEnv.LEGACY_ONLY, undefined);
      assert.deepEqual(result.loadedEnvFiles, []);
    }
    const child = require('node:child_process').spawnSync(process.execPath, ['-e', "const e=require('@next/env').loadEnvConfig(process.argv[1]); if(e.combinedEnv.PROD_ONLY || e.loadedEnvFiles.length) process.exit(1)", process.argv[1]], {env: process.env});
    assert.equal(child.status, 0);
  `;
  const result = spawnSync(process.execPath, ["-e", source, root], { env: environment, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
