import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("리뷰 목록 조회 실패는 화면 내부의 안전한 재시도로 복구한다", async () => {
  const source = await readFile(
    new URL(
      "../src/app/admin/(protected)/reviews/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /try \{[\s\S]*getAdminReviewPageData/);
  assert.match(source, /catch \{[\s\S]*AdminStatePanel/);
  assert.match(source, /리뷰 목록을 불러오지 못했습니다\./);
  assert.match(source, /<Button href=\{returnTo\} variant="secondary">다시 확인<\/Button>/);
  assert.doesNotMatch(source, /error\.message/);
});

test("관리 기준·템플릿·광고 초기 조회 실패는 내부 오류 대신 재시도를 제공한다", async () => {
  const routeSources = await Promise.all(
    [
      "../src/app/admin/(protected)/cycle/page.tsx",
      "../src/app/admin/(protected)/notification-templates/page.tsx",
      "../src/app/admin/(protected)/advertisement/page.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  for (const source of routeSources) {
    assert.match(source, /AdminStatePanel/);
    assert.match(source, /kind="error"/);
    assert.match(source, /다시 확인/);
    assert.doesNotMatch(source, /error\.message/);
  }
});
