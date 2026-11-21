import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  A11Y_KNOWN_VIOLATIONS,
  A11Y_SMOKE_COLOR_SCHEMES,
  A11Y_SMOKE_ROUTES,
  A11Y_SMOKE_VIEWPORT,
  buildA11ySmokeEntryPath,
  findStaleAllowlistEntries,
  selectBlockingViolations,
  summarizeViolations,
} from "./e2e/a11y-policy.ts";

const violation = (id: string, impact: string | null) => ({
  id,
  impact,
  help: `${id} help`,
  nodes: [{ target: ["main", ".target"] }],
});

test("스모크 범위는 홈·로그인·인증 카드·iOS 설치 안내 × 360px × 라이트·다크다", () => {
  assert.deepEqual(
    A11Y_SMOKE_ROUTES.map((route) => route.path),
    ["/", "/auth/login", "/certification", "/install?platform=ios"],
  );
  assert.deepEqual([...A11Y_SMOKE_COLOR_SCHEMES], ["light", "dark"]);
  assert.equal(A11Y_SMOKE_VIEWPORT.width, 360);
  assert.equal(
    buildA11ySmokeEntryPath(A11Y_SMOKE_ROUTES[2]!),
    "/auth/mock?returnTo=%2Fcertification",
  );
  assert.equal(buildA11ySmokeEntryPath(A11Y_SMOKE_ROUTES[0]!), "/");
});

test("critical·serious 위반만 실패로 보고 moderate·minor는 무시한다", () => {
  const blocking = selectBlockingViolations(
    "/",
    "light",
    [
      violation("color-contrast", "serious"),
      violation("button-name", "critical"),
      violation("region", "moderate"),
      violation("landmark-unique", "minor"),
      violation("unknown-impact", null),
    ],
    [],
  );
  assert.deepEqual(blocking.map((item) => item.id), ["color-contrast", "button-name"]);
});

test("allowlist는 경로·규칙·색 모드가 정확히 맞을 때만 허용한다", () => {
  const allowlist = [
    { path: "/", ruleId: "color-contrast", colorScheme: "dark" as const, reason: "토큰 대비 개선 대기", owner: "RF-15" },
  ];
  const violations = [violation("color-contrast", "serious")];

  assert.equal(selectBlockingViolations("/", "dark", violations, allowlist).length, 0);
  assert.equal(selectBlockingViolations("/", "light", violations, allowlist).length, 1);
  assert.equal(selectBlockingViolations("/auth/login", "dark", violations, allowlist).length, 1);
  assert.deepEqual(findStaleAllowlistEntries("/", "dark", [], allowlist), allowlist);
  assert.deepEqual(findStaleAllowlistEntries("/", "dark", violations, allowlist), []);
});

test("기존 위반 allowlist 항목은 사유와 담당을 남기고 와일드카드를 쓰지 않는다", () => {
  for (const entry of A11Y_KNOWN_VIOLATIONS) {
    assert.ok(entry.reason.trim().length > 0);
    assert.ok(entry.owner.trim().length > 0);
    assert.ok(A11Y_SMOKE_ROUTES.some((route) => route.path === entry.path), entry.path);
    assert.doesNotMatch(entry.ruleId, /\*/);
  }
});

test("요약은 규칙·영향·대상 선택자를 실패 메시지로 남긴다", () => {
  assert.equal(
    summarizeViolations([violation("button-name", "critical")]),
    "button-name (critical): button-name help → main .target",
  );
});

test("스모크 spec은 axe 결과를 정책 함수로 판정하고 규칙을 전역 비활성화하지 않는다", () => {
  const spec = readFileSync(new URL("./e2e/a11y-smoke.spec.ts", import.meta.url), "utf8");
  assert.match(spec, /import AxeBuilder from "@axe-core\/playwright";/);
  assert.match(spec, /selectBlockingViolations\(route\.path, colorScheme, results\.violations\)/);
  assert.match(spec, /window\.localStorage\.setItem\("theme", theme\)/);
  assert.doesNotMatch(spec, /disableRules|\.exclude\(/);
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { devDependencies?: Record<string, string> };
  assert.ok(packageJson.devDependencies?.["@axe-core/playwright"]);
});
