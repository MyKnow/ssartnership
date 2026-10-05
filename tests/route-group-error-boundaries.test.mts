import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function read(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("공개·파트너 그룹 오류 경계는 그룹 셸 안에서 embedded 오류 화면을 렌더한다", async () => {
  const [siteError, partnerError] = await Promise.all([
    read("src/app/(site)/error.tsx"),
    read("src/app/partner/error.tsx"),
  ]);

  for (const source of [siteError, partnerError]) {
    assert.match(source, /^"use client";/);
    assert.match(source, /layout="embedded"/);
    assert.match(source, /onRetry=\{retry\}/);
    assert.match(source, /digest=\{error\.digest\}/);
    assert.match(source, /console\.error\(error\)/);
  }

  // (site) 페이지는 각자 <main>을 소유하므로 오류 경계도 main 랜드마크를 제공한다.
  assert.match(siteError, /<main>/);
  // 파트너 셸은 이미 <main>으로 children을 감싸므로 중첩 main을 만들지 않는다.
  assert.doesNotMatch(partnerError, /<main/);
});

test("AppErrorScreen은 page 기본값을 유지하고 embedded에서만 전체 화면 main을 제거한다", async () => {
  const [screen, rootError, globalError] = await Promise.all([
    read("src/components/errors/AppErrorScreen.tsx"),
    read("src/app/error.tsx"),
    read("src/app/global-error.tsx"),
  ]);

  assert.match(screen, /layout = "page"/);
  assert.match(screen, /page: "flex min-h-screen/);
  assert.match(screen, /embedded: "flex min-h-\[60vh\]/);
  assert.match(screen, /const Root = layout === "page" \? "main" : "div";/);
  for (const source of [rootError, globalError]) {
    assert.doesNotMatch(source, /layout=/);
  }
});
