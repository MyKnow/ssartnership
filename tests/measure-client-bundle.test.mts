import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyNextAsset,
  extractNextStaticAssets,
  formatSummaryTable,
  parseArgs,
  summarizeRouteAssets,
} from "../scripts/measure-client-bundle.mjs";

const SAMPLE_HTML = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="/_next/static/css/a1b2.css" data-precedence="next"/>
<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/webpack-89212b2f.js"/>
<script src="/_next/static/chunks/webpack-89212b2f.js" async=""></script>
<script src="/_next/static/chunks/4bd1b696-d0827a14.js" async=""></script>
<script src="/_next/static/chunks/main-app-dd4111b7.js" async=""></script>
<script src="/_next/static/chunks/app/layout-daf6b4f4.js" async=""></script>
<script src="/_next/static/chunks/app/(site)/layout-fa617cc0.js" async=""></script>
<script src="/_next/static/chunks/app/%28site%29/partners/%5Bid%5D/page-12ab.js?dpl=abc" async=""></script>
<script src="/_next/static/chunks/app/(site)/loading-30985f4f.js" async=""></script>
<script src="/_next/static/chunks/polyfills-42372ed1.js" noModule=""></script>
<link rel="icon" href="/_next/static/media/icon.png"/>
<link rel="preload" as="font" href="/_next/static/media/PretendardVariable.subset.0.woff2"/>
<script>self.__next_f.push([1,"/_next/static/chunks/inline-mention.js"])</script>
</head><body></body></html>`;

test("HTML에서 첫 로드 JS·CSS 자산만 순서대로 중복 없이 뽑고 nomodule 폴리필은 뺀다", () => {
  const { scripts, styles } = extractNextStaticAssets(SAMPLE_HTML);

  assert.deepEqual(styles, ["/_next/static/css/a1b2.css"]);
  assert.deepEqual(scripts, [
    "/_next/static/chunks/webpack-89212b2f.js",
    "/_next/static/chunks/4bd1b696-d0827a14.js",
    "/_next/static/chunks/main-app-dd4111b7.js",
    "/_next/static/chunks/app/layout-daf6b4f4.js",
    "/_next/static/chunks/app/(site)/layout-fa617cc0.js",
    "/_next/static/chunks/app/%28site%29/partners/%5Bid%5D/page-12ab.js",
    "/_next/static/chunks/app/(site)/loading-30985f4f.js",
  ]);
});

test("청크 경로를 런타임·레이아웃·페이지·경계·공유·CSS로 분류한다", () => {
  assert.equal(classifyNextAsset("/_next/static/chunks/webpack-1.js"), "runtime");
  assert.equal(classifyNextAsset("/_next/static/chunks/main-app-1.js"), "runtime");
  assert.equal(classifyNextAsset("/_next/static/chunks/app/layout-1.js"), "root-layout");
  assert.equal(classifyNextAsset("/_next/static/chunks/app/(site)/layout-1.js"), "site-layout");
  assert.equal(classifyNextAsset("/_next/static/chunks/app/%28site%29/layout-1.js"), "site-layout");
  assert.equal(classifyNextAsset("/_next/static/chunks/app/admin/(protected)/layout-1.js"), "nested-layout");
  assert.equal(classifyNextAsset("/_next/static/chunks/app/(site)/page-1.js"), "page");
  assert.equal(
    classifyNextAsset("/_next/static/chunks/app/%28site%29/partners/%5Bid%5D/page-1.js"),
    "page",
  );
  assert.equal(classifyNextAsset("/_next/static/chunks/app/(site)/loading-1.js"), "boundary");
  assert.equal(classifyNextAsset("/_next/static/chunks/app/error-1.js"), "boundary");
  assert.equal(classifyNextAsset("/_next/static/chunks/4bd1b696-1.js"), "shared");
  assert.equal(classifyNextAsset("/_next/static/css/a.css"), "css");
});

test("경로 요약은 CSS를 JS 합계에서 빼고 범주별 gzip 크기를 표로 낸다", () => {
  const summary = summarizeRouteAssets("/", [
    { pathname: "/_next/static/chunks/webpack-1.js", rawBytes: 4000, gzipBytes: 2048 },
    { pathname: "/_next/static/chunks/app/layout-1.js", rawBytes: 3000, gzipBytes: 1024 },
    { pathname: "/_next/static/chunks/app/(site)/page-1.js", rawBytes: 9000, gzipBytes: 3072 },
    { pathname: "/_next/static/chunks/123-1.js", rawBytes: 1000, gzipBytes: 512 },
    { pathname: "/_next/static/css/a.css", rawBytes: 60000, gzipBytes: 10240 },
  ]);

  assert.equal(summary.jsCount, 4);
  assert.equal(summary.jsRawBytes, 17000);
  assert.equal(summary.jsGzipBytes, 6656);
  assert.equal(summary.byCategory.css.gzipBytes, 10240);
  assert.equal(summary.byCategory["site-layout"].count, 0);

  const table = formatSummaryTable([summary]);
  assert.match(table, /^\| 경로 \| JS 파일 수 \| first-load JS gz/);
  assert.match(table, /\| `\/` \| 4 \| 6\.5 \| 2\.0 \| 1\.0 \| 0\.0 \| 0\.0 \| 3\.0 \| 0\.0 \| 0\.5 \| 10\.0 \|$/m);
});

test("인자는 기본 경로·여러 --route·JSON 출력을 받고 잘못된 경로는 거부한다", () => {
  assert.deepEqual(parseArgs([]).routes, ["/"]);
  const options = parseArgs([
    "--base-url",
    "http://127.0.0.1:3333",
    "--route",
    "/",
    "--route",
    "/partners/abc",
    "--dist-dir",
    ".next",
    "--json",
  ]);
  assert.equal(options.baseUrl, "http://127.0.0.1:3333");
  assert.deepEqual(options.routes, ["/", "/partners/abc"]);
  assert.equal(options.json, true);
  assert.throws(() => parseArgs(["--route", "partners"]), /\/로 시작/);
  assert.throws(() => parseArgs(["--route"]), /값이 필요/);
  assert.throws(() => parseArgs(["--unknown"]), /알 수 없는 인자/);
});
