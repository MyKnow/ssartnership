import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  formatCount,
  formatKoreanWon,
  formatPercent,
  KOREAN_NUMBER_LOCALE,
} from "@/lib/number-format";

test("숫자·통화·퍼센트 표기는 ko-KR 구분 기호로 고정된다", () => {
  assert.equal(KOREAN_NUMBER_LOCALE, "ko-KR");
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(1234567), "1,234,567");
  assert.equal(formatCount(-1200), "-1,200");
  assert.equal(formatKoreanWon(33000), "33,000원");
  assert.equal(formatKoreanWon(0), "0원");
  assert.equal(formatPercent(12.4), "12%");
  assert.equal(formatPercent(12.5), "13%");
  assert.equal(formatPercent(100), "100%");
  assert.equal(formatPercent(12.34, 1), "12.3%");
  assert.equal(formatPercent(5, 1), "5.0%");
});

// RF-10이 이 화면의 집계 섹션을 컴포넌트로 옮기는 중이라 충돌을 피하려고 일시 제외한다.
// 통합 시 옮겨진 컴포넌트에 같은 로케일 고정을 적용하고 이 예외를 지운다.
const NO_ARG_LOCALE_EXCEPTIONS = new Set(["app/admin/(protected)/event/[slug]/page.tsx"]);

function listSourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) return listSourceFiles(child);
    return /\.(?:ts|tsx)$/u.test(entry.name) && !/\.stories\.tsx$/u.test(entry.name) ? [child] : [];
  });
}

test("런타임 기본 로케일에 기대는 무인자 toLocaleString()과 로컬 숫자 포맷터를 다시 만들지 않는다", () => {
  const sourceRoot = new URL("../src/", import.meta.url);
  const offenders: string[] = [];
  for (const file of listSourceFiles(sourceRoot)) {
    const relative = decodeURIComponent(file.href.slice(sourceRoot.href.length));
    if (relative === "lib/number-format.ts") continue;
    const source = readFileSync(file, "utf8");
    if (!NO_ARG_LOCALE_EXCEPTIONS.has(relative) && /\.toLocaleString\(\)/u.test(source)) {
      offenders.push(`${relative}: toLocaleString()`);
    }
    if (/^function format(?:Count|Currency|Percent)\(/mu.test(source)) {
      offenders.push(`${relative}: local number formatter`);
    }
  }
  assert.deepEqual(offenders, []);
});
