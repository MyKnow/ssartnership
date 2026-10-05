import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const themePreferenceModulePromise = import(
  new URL("../src/lib/theme-preference.ts", import.meta.url).href
) as Promise<typeof import("../src/lib/theme-preference.ts")>;

function read(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function errorBoundaryFiles() {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "src/app"],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter(
      (file) =>
        /(^|\/)(global-)?error\.tsx$/.test(file) &&
        existsSync(new URL(`../${file}`, import.meta.url)),
    )
    .sort();
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

test("모든 오류 경계의 다시 시도는 세그먼트를 다시 불러오는 retry()를 쓴다", async () => {
  const files = errorBoundaryFiles();
  // 새 경계는 아래 반복에서 자동으로 검사하고, 기존 다섯 경계가 탐색에서 빠지지 않는지만 고정한다.
  for (const expected of [
    "src/app/(site)/error.tsx",
    "src/app/admin/(protected)/error.tsx",
    "src/app/error.tsx",
    "src/app/global-error.tsx",
    "src/app/partner/error.tsx",
  ]) {
    assert.ok(files.includes(expected), `${expected} 오류 경계를 찾지 못했습니다.`);
  }

  for (const file of files) {
    const source = await read(file);
    // Next.js 16.3의 reset()은 서버 컴포넌트를 다시 불러오지 않아 서버 예외가 그대로 남는다.
    assert.match(source, /\bretry: \(\) => void;/, file);
    assert.match(source, /(onRetry|onClick)=\{retry\}/, file);
    assert.doesNotMatch(source, /\breset\b/, file);
  }
});

test("global-error는 루트 layout과 같은 전역 CSS를 직접 불러와 다른 오류 화면과 같은 모양을 유지한다", async () => {
  const [globalError, layout] = await Promise.all([
    read("src/app/global-error.tsx"),
    read("src/app/layout.tsx"),
  ]);
  const fontCss = 'import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";';
  const globalsCss = 'import "./globals.css";';

  for (const source of [layout, globalError]) {
    assert.ok(source.includes(fontCss));
    assert.ok(source.includes(globalsCss));
    assert.ok(source.indexOf(fontCss) < source.indexOf(globalsCss));
  }
  // global-error는 자체 문서를 렌더하므로 html·body를 직접 소유하고, body는 루트 layout과 같은 클래스를 쓴다.
  assert.match(globalError, /<html\s+lang="ko"[^>]*\ssuppressHydrationWarning\s*>/);
  const bodyClassName = /<body className="([^"]+)">/;
  const layoutBody = layout.match(bodyClassName)?.[1];
  assert.ok(layoutBody, "루트 layout body 클래스를 찾지 못했습니다.");
  assert.equal(globalError.match(bodyClassName)?.[1], layoutBody);
});

test("global-error는 ThemeProvider와 같은 저장 키·기본값으로 해석한 테마를 html에 적용한다", async () => {
  const [globalError, themeProvider, hook] = await Promise.all([
    read("src/app/global-error.tsx"),
    read("src/components/ThemeProvider.tsx"),
    read("src/hooks/useStoredResolvedTheme.ts"),
  ]);
  const {
    DEFAULT_THEME_PREFERENCE,
    THEME_STORAGE_KEY,
    resolveThemePreference,
  } = await themePreferenceModulePromise;

  // next-themes 기본 저장 키·이 앱의 기본 테마를 그대로 유지해 기존 사용자 선택이 이어진다.
  assert.equal(THEME_STORAGE_KEY, "theme");
  assert.equal(DEFAULT_THEME_PREFERENCE, "light");
  assert.match(themeProvider, /attribute="class"/);
  assert.match(themeProvider, /storageKey=\{THEME_STORAGE_KEY\}/);
  assert.match(themeProvider, /defaultTheme=\{DEFAULT_THEME_PREFERENCE\}/);
  assert.match(themeProvider, /\benableSystem\b/);

  assert.equal(resolveThemePreference(null, true), "light");
  assert.equal(resolveThemePreference("", true), "light");
  assert.equal(resolveThemePreference("dark", false), "dark");
  assert.equal(resolveThemePreference("light", true), "light");
  assert.equal(resolveThemePreference("system", true), "dark");
  assert.equal(resolveThemePreference("system", false), "light");
  assert.equal(resolveThemePreference("unknown", true), "light");

  // 저장소 접근 실패는 기본 테마로 처리하고, 서버·hydration 중에는 기본 테마를 쓴다.
  assert.match(hook, /localStorage\.getItem\(THEME_STORAGE_KEY\)/);
  assert.match(hook, /catch \{/);
  assert.match(hook, /useSyncExternalStore\(subscribe, getSnapshot, getServerSnapshot\)/);

  assert.match(globalError, /const theme = useStoredResolvedTheme\(\);/);
  assert.match(globalError, /className=\{theme\}/);
  assert.match(globalError, /style=\{\{ colorScheme: theme \}\}/);
});
