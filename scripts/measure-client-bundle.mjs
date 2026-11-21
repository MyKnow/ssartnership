#!/usr/bin/env node
// 실행 중인 production 서버(next start)의 익명 HTML에서 첫 로드 JS·CSS 자산을 모아
// 레이아웃·페이지 단위로 gzip 크기를 집계한다. 측정 절차와 기준선 기록 위치는
// docs/performance/baselines/2026-10-05-client-bundle.md를 따른다.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

export const DEFAULT_ROUTES = ["/"];
export const GZIP_LEVEL = 9;

const NEXT_STATIC_PATTERN = /(?:src|href)=["']([^"']*\/_next\/static\/[^"']+?\.(?:js|css))(?:\?[^"']*)?["']/g;
const TAG_PATTERN = /<(script|link)\b[^>]*>/gi;

/**
 * HTML의 `<script src>`·`<link href>`에서 `/_next/static` JS·CSS 경로를 순서대로 중복 없이 뽑는다.
 * `nomodule` 폴리필은 최신 브라우저가 받지 않으므로 제외한다.
 */
export function extractNextStaticAssets(html) {
  const scripts = [];
  const styles = [];
  const seen = new Set();
  for (const tagMatch of html.matchAll(TAG_PATTERN)) {
    const tag = tagMatch[0];
    if (/\snomodule\b/i.test(tag)) {
      continue;
    }
    const isLink = tagMatch[1].toLowerCase() === "link";
    if (isLink && !/\brel=["'](?:stylesheet|preload|modulepreload)["']/i.test(tag)) {
      continue;
    }
    for (const assetMatch of tag.matchAll(NEXT_STATIC_PATTERN)) {
      const pathname = assetMatch[1].slice(assetMatch[1].indexOf("/_next/static/"));
      if (seen.has(pathname)) {
        continue;
      }
      seen.add(pathname);
      (pathname.endsWith(".css") ? styles : scripts).push(pathname);
    }
  }
  return { scripts, styles };
}

/** 자산 경로를 기준선 표의 열(runtime·root-layout·site-layout·nested-layout·page·boundary·shared·css)로 분류한다. */
export function classifyNextAsset(pathname) {
  if (pathname.endsWith(".css")) {
    return "css";
  }
  const decoded = decodeURIComponent(pathname);
  const chunk = decoded.replace(/^.*\/_next\/static\/chunks\//, "");
  if (/^(?:webpack|main-app|main|framework|polyfills)-[^/]+\.js$/.test(chunk)) {
    return "runtime";
  }
  if (/^app\/layout-[^/]+\.js$/.test(chunk)) {
    return "root-layout";
  }
  if (/^app\/\(site\)\/layout-[^/]+\.js$/.test(chunk)) {
    return "site-layout";
  }
  if (/^app\/.+\/layout-[^/]+\.js$/.test(chunk)) {
    return "nested-layout";
  }
  if (/^app\/(?:.+\/)?page-[^/]+\.js$/.test(chunk)) {
    return "page";
  }
  if (/^app\/(?:.+\/)?(?:loading|error|not-found|global-error|template|default)-[^/]+\.js$/.test(chunk)) {
    return "boundary";
  }
  return "shared";
}

export const ASSET_CATEGORIES = [
  "runtime",
  "root-layout",
  "site-layout",
  "nested-layout",
  "page",
  "boundary",
  "shared",
  "css",
];

/** 자산별 크기 목록을 경로 기준 합계로 묶는다. JS 합계에는 css를 넣지 않는다. */
export function summarizeRouteAssets(route, assets) {
  const byCategory = Object.fromEntries(
    ASSET_CATEGORIES.map((category) => [category, { count: 0, rawBytes: 0, gzipBytes: 0 }]),
  );
  for (const asset of assets) {
    const bucket = byCategory[classifyNextAsset(asset.pathname)];
    bucket.count += 1;
    bucket.rawBytes += asset.rawBytes;
    bucket.gzipBytes += asset.gzipBytes;
  }
  const jsCategories = ASSET_CATEGORIES.filter((category) => category !== "css");
  const sum = (key) => jsCategories.reduce((total, category) => total + byCategory[category][key], 0);
  return {
    route,
    jsCount: jsCategories.reduce((total, category) => total + byCategory[category].count, 0),
    jsRawBytes: sum("rawBytes"),
    jsGzipBytes: sum("gzipBytes"),
    byCategory,
  };
}

export function formatKilobytes(bytes) {
  return (bytes / 1024).toFixed(1);
}

/** 기준선 문서에 붙여 넣을 Markdown 표(gzip KB)를 만든다. */
export function formatSummaryTable(summaries) {
  const header = [
    "| 경로 | JS 파일 수 | first-load JS gz | runtime | root layout | (site) layout | 기타 layout | page | loading·error | shared | CSS gz |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  const rows = summaries.map((summary) => {
    const gz = (category) => formatKilobytes(summary.byCategory[category].gzipBytes);
    return `| \`${summary.route}\` | ${summary.jsCount} | ${formatKilobytes(summary.jsGzipBytes)} | ${gz("runtime")} | ${gz("root-layout")} | ${gz("site-layout")} | ${gz("nested-layout")} | ${gz("page")} | ${gz("boundary")} | ${gz("shared")} | ${gz("css")} |`;
  });
  return [...header, ...rows].join("\n");
}

export function parseArgs(argv) {
  const options = { baseUrl: "http://127.0.0.1:3000", distDir: ".next", routes: [], json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} 값이 필요합니다.`);
      }
      index += 1;
      return value;
    };
    if (arg === "--base-url") options.baseUrl = next();
    else if (arg === "--dist-dir") options.distDir = next();
    else if (arg === "--route") options.routes.push(next());
    else if (arg === "--json") options.json = true;
    else throw new Error(`알 수 없는 인자: ${arg}`);
  }
  if (options.routes.length === 0) {
    options.routes = [...DEFAULT_ROUTES];
  }
  for (const route of options.routes) {
    if (!route.startsWith("/")) {
      throw new Error(`경로는 /로 시작해야 합니다: ${route}`);
    }
  }
  return options;
}

async function readAsset(pathname, options) {
  const relative = pathname.replace(/^.*\/_next\/static\//, "");
  try {
    return await readFile(resolve(options.distDir, "static", decodeURIComponent(relative)));
  } catch {
    const response = await fetch(new URL(pathname, options.baseUrl));
    if (!response.ok) {
      throw new Error(`${pathname} 자산을 읽지 못했습니다(${response.status}).`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}

async function measureRoute(route, options) {
  // 쿠키 없이 요청해 익명 첫 방문 기준을 잰다. 로그인 경로 비교는 문서 절차의 수동 단계로 둔다.
  const response = await fetch(new URL(route, options.baseUrl), { redirect: "manual" });
  if (response.status !== 200) {
    throw new Error(`${route} 응답이 200이 아닙니다(${response.status}). 경로와 서버 상태를 확인하세요.`);
  }
  const html = await response.text();
  const { scripts, styles } = extractNextStaticAssets(html);
  const assets = await Promise.all(
    [...scripts, ...styles].map(async (pathname) => {
      const body = await readAsset(pathname, options);
      return {
        pathname,
        rawBytes: body.byteLength,
        gzipBytes: gzipSync(body, { level: GZIP_LEVEL }).byteLength,
      };
    }),
  );
  return { ...summarizeRouteAssets(route, assets), assets };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const summaries = [];
  for (const route of options.routes) {
    summaries.push(await measureRoute(route, options));
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ baseUrl: options.baseUrl, gzipLevel: GZIP_LEVEL, summaries }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${formatSummaryTable(summaries)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
