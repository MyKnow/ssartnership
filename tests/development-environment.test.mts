import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLocalDevelopmentEnv,
  classifyPlatform,
  parseEnvFile,
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
