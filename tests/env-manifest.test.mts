import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ENVIRONMENT_VARIABLES,
  extractEnvironmentReads,
  findEnvironmentDrift,
  parseEnvironmentExample,
} from "../scripts/lib/env-manifest.mjs";
import {
  checkEnvironment,
  collectApplicationEnvironmentReads,
  readRealRequiredEnvironmentNames,
} from "../scripts/check-env.mjs";
import {
  DEPRECATED_ENVIRONMENT_ALIASES,
  formatDeprecatedEnvironmentAliasWarning,
  resetDeprecatedEnvironmentAliasWarnings,
  warnDeprecatedEnvironmentAlias,
} from "../src/lib/env-deprecation.ts";

function readRepoFile(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("현재 저장소의 매니페스트·예시 파일·코드 env 읽기는 drift가 없다", () => {
  assert.deepEqual(checkEnvironment(), []);
});

test("env 읽기 추출은 직접 접근·주입 객체·이름 상수·readEnv 호출을 모두 찾는다", () => {
  const reads = extractEnvironmentReads(`
    const a = process.env.ALPHA_KEY;
    const b = env.BETA_KEY ?? environment.GAMMA_KEY;
    const c = process.env["DELTA_KEY"];
    const DEVICE_ENV_NAME =
      "EPSILON_KEY";
    readEnv("ZETA_KEY");
    const ignored = source.NOT_ENV;
  `);
  assert.deepEqual(
    [...reads].sort(),
    ["ALPHA_KEY", "BETA_KEY", "DELTA_KEY", "EPSILON_KEY", "GAMMA_KEY", "ZETA_KEY"],
  );
});

test("예시 파일 파서는 주석 처리된 선택 항목을 구분한다", () => {
  const entries = parseEnvironmentExample("A_KEY=1\n# B_KEY=2\n#   C_KEY=\n# not a key\nD_KEY");
  assert.deepEqual([...entries.entries()], [
    ["A_KEY", { commented: false }],
    ["B_KEY", { commented: true }],
    ["C_KEY", { commented: true }],
  ]);
});

test("drift 검사는 미등록·미사용·폐기 별칭 안내·누락을 모두 보고한다", () => {
  const manifest = [
    { name: "REQUIRED_KEY", tier: "required", secret: true, group: "test" },
    { name: "OPTIONAL_KEY", tier: "optional", secret: false, group: "test" },
    { name: "OLD_KEY", tier: "legacy", secret: false, group: "test", replacement: "OPTIONAL_KEY" },
    { name: "UNUSED_KEY", tier: "optional", secret: false, group: "test" },
    { name: "MOCK_KEY", tier: "development", secret: false, group: "test" },
  ] as const;
  const problems = findEnvironmentDrift({
    manifest,
    sourceReads: new Set(["REQUIRED_KEY", "OPTIONAL_KEY", "OLD_KEY", "MOCK_KEY", "NEW_KEY"]),
    envExample: "REQUIRED_KEY=x\nOLD_KEY=x\nMOCK_KEY=1\n",
    runtimeExample: "# REQUIRED_KEY=x\nMOCK_KEY=1\n",
    realRequiredNames: ["REQUIRED_KEY", "OTHER_REQUIRED"],
  });

  for (const expected of [
    "NEW_KEY: 코드가 읽지만 매니페스트에 없음",
    "UNUSED_KEY: 매니페스트에 있지만 코드가 읽지 않음",
    ".env.example: 폐기 예정 별칭 OLD_KEY을 안내하면 안 됨",
    ".env.example: OPTIONAL_KEY 누락",
    ".env.example: 개발 전용 MOCK_KEY은 주석으로만 안내",
    "runtime.env.example: required REQUIRED_KEY 누락",
    "runtime.env.example: 선택 값 OPTIONAL_KEY을 주석으로라도 안내해야 함",
    "runtime.env.example: 개발 전용 MOCK_KEY은 자체 호스팅 런타임에 두지 않음",
  ]) {
    assert.ok(problems.includes(expected), `missing problem: ${expected}\n${problems.join("\n")}`);
  }
  assert.ok(problems.some((problem) => problem.startsWith("required tier가 runtime-env.mjs")));
});

test("required tier는 자체 호스팅 real 모드 필수 목록과 같다", () => {
  const required = ENVIRONMENT_VARIABLES
    .filter((entry) => entry.tier === "required" && !entry.dynamic)
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(required, readRealRequiredEnvironmentNames().sort());
});

test("코드는 Vercel 계정 라우팅·Cloud Preview 동기화 env를 더 이상 읽지 않는다", () => {
  const reads = collectApplicationEnvironmentReads();
  for (const retired of [
    "SSARTNERSHIP_VERCEL_TOKEN",
    "SUPABASE_PREVIEW_URL",
    "SUPABASE_PREVIEW_SERVICE_ROLE_KEY",
    "SUPABASE_PRODUCTION_DB_URL",
    "PREVIEW_TEST_MEMBER_USERNAME",
    "PREVIEW_TEST_MEMBER_PASSWORD",
    "ADMIN_PREVIEW_PROTECTION_BYPASS",
  ]) {
    assert.equal(reads.has(retired), false, `${retired} must stay retired`);
    assert.equal(ENVIRONMENT_VARIABLES.some((entry) => entry.name === retired), false);
  }
});

test("폐기 예정 별칭은 매니페스트 legacy tier와 경고 목록이 일치한다", () => {
  const legacyAliases = ENVIRONMENT_VARIABLES
    .filter((entry) => entry.tier === "legacy" && entry.replacement)
    .map((entry) => [entry.name, entry.replacement]);
  assert.deepEqual(
    Object.fromEntries(legacyAliases),
    { ...DEPRECATED_ENVIRONMENT_ALIASES },
  );
});

test("폐기 예정 별칭 경고는 프로세스당 한 번, 이름만 남긴다", () => {
  resetDeprecatedEnvironmentAliasWarnings();
  const messages: string[] = [];
  assert.equal(warnDeprecatedEnvironmentAlias("DATA_GO_KR_SERVICE_KEY", (message) => messages.push(message)), true);
  assert.equal(warnDeprecatedEnvironmentAlias("DATA_GO_KR_SERVICE_KEY", (message) => messages.push(message)), false);
  assert.deepEqual(messages, [formatDeprecatedEnvironmentAliasWarning("DATA_GO_KR_SERVICE_KEY")]);
  assert.match(messages[0], /DATA_GO_KR_SERVICE_KEY.+NTS_BUSINESS_STATUS_SERVICE_KEY/u);
  resetDeprecatedEnvironmentAliasWarnings();
});

test("legacy 별칭을 읽는 코드는 폐기 경고를 남긴다", () => {
  const smtp = readRepoFile("src/lib/smtp.ts");
  const nts = readRepoFile("src/lib/nts-business-status.ts");
  assert.match(smtp, /warnDeprecatedEnvironmentAlias\("NAVER_SMTP_USER"\)/u);
  assert.match(smtp, /warnDeprecatedEnvironmentAlias\("NAVER_SMTP_PASS"\)/u);
  assert.match(nts, /warnDeprecatedEnvironmentAlias\("DATA_GO_KR_SERVICE_KEY"\)/u);
});
