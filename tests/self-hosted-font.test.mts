import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const FONT_CSS = "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";

function read(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("루트 레이아웃은 Pretendard를 외부 CDN 없이 번들 CSS로 자체 서빙한다", async () => {
  const layout = await read("src/app/layout.tsx");

  assert.ok(layout.includes(`import "${FONT_CSS}";`));
  assert.ok(
    layout.indexOf(FONT_CSS) < layout.indexOf('import "./globals.css";'),
    "폰트 CSS는 globals.css보다 먼저 로드해 --font-sans가 같은 패밀리를 참조한다.",
  );
  assert.doesNotMatch(layout, /cdn\.jsdelivr\.net/);
  assert.doesNotMatch(layout, /<link[^>]+rel="stylesheet"/);
});

test("Storybook과 앱이 같은 Pretendard 분할 CSS를 쓰고 런타임 의존성으로 고정된다", async () => {
  const [preview, packageJson] = await Promise.all([
    read(".storybook/preview.tsx"),
    read("package.json"),
  ]);
  const manifest = JSON.parse(packageJson) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  assert.ok(preview.includes(`import "${FONT_CSS}";`));
  assert.ok(manifest.dependencies?.pretendard, "pretendard는 앱 번들에 들어가므로 dependencies에 둔다.");
  assert.equal(manifest.devDependencies?.pretendard, undefined);
});

test("분할 CSS는 상대 woff2 경로와 swap으로 --font-sans 1순위 패밀리를 선언한다", async () => {
  const [fontCss, globals] = await Promise.all([
    read(`node_modules/${FONT_CSS}`),
    read("src/app/globals.css"),
  ]);
  const families = new Set(
    Array.from(fontCss.matchAll(/font-family:\s*'([^']+)'/g), (match) => match[1]),
  );
  const sources = Array.from(fontCss.matchAll(/src:\s*url\(([^)]+)\)/g), (match) => match[1]);

  assert.deepEqual([...families], ["Pretendard Variable"]);
  assert.ok(sources.length > 1);
  for (const source of sources) {
    assert.match(source, /^\.\/woff2-dynamic-subset\/[^/]+\.woff2$/);
  }
  const displays = new Set(
    Array.from(fontCss.matchAll(/font-display:\s*([a-z-]+)/g), (match) => match[1]),
  );
  assert.deepEqual([...displays], ["swap"]);
  assert.match(fontCss, /unicode-range:/);
  assert.match(globals, /--font-sans:\s*"Pretendard Variable",/);
  // 번들 minifier가 일반 주석을 지우므로 OFL 고지는 `/*!` 보존 주석으로 둔다.
  assert.match(globals, /^\/\*! Pretendard[\s\S]*?SIL Open Font License/);
});
