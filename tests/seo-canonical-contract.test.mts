import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appDir = fileURLToPath(new URL("../src/app/", import.meta.url));
const siteDir = path.join(appDir, "(site)");

function listPageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listPageFiles(entryPath);
    return entry.name === "page.tsx" ? [entryPath] : [];
  });
}

function readAppSource(relativePath: string) {
  return readFileSync(path.join(appDir, relativePath), "utf8");
}

// Pages that are indexable but intentionally have no canonical of their own.
// Keep each entry justified; an empty list is the goal.
const CANONICAL_EXEMPT_PAGES = new Map<string, string>();

test("root layout does not leak a home canonical or og:url into child segments", () => {
  const layout = readAppSource("layout.tsx");
  assert.doesNotMatch(layout, /createCanonicalAlternates/);
  assert.doesNotMatch(layout, /canonical:/);
  assert.doesNotMatch(layout, /\burl:\s*"\/"/);
  assert.match(layout, /"application\/rss\+xml": SITE_RSS_URL/);
});

test("every (site) page either declares its own canonical or opts out of indexing", () => {
  const pages = listPageFiles(siteDir);
  assert.ok(pages.length >= 20, "expected the public site route inventory");

  const missing = pages
    .map((pagePath) => path.relative(siteDir, pagePath))
    .filter((relativePath) => !CANONICAL_EXEMPT_PAGES.has(relativePath))
    .filter((relativePath) => {
      const source = readFileSync(path.join(siteDir, relativePath), "utf8");
      return !/createCanonicalAlternates\(/.test(source) && !/index:\s*false/.test(source);
    });

  assert.deepEqual(missing, []);
});

test("indexable public pages point og:url at their own canonical path", () => {
  const expectations: Array<[string, RegExp]> = [
    ["(site)/install/page.tsx", /createCanonicalAlternates\(INSTALL_PATH\)[\s\S]*createPageOpenGraph\(\{\s*path: INSTALL_PATH/],
    ["(site)/events/project-showcase/page.tsx", /createCanonicalAlternates\(EVENT_PATH\)[\s\S]*createPageOpenGraph\(\{\s*path: EVENT_PATH/],
    [
      "(site)/events/project-showcase/projects/[projectId]/page.tsx",
      /const projectPath = `\$\{EVENT_PATH\}\/projects\/\$\{encodeURIComponent\(project\.id\)\}`[\s\S]*createCanonicalAlternates\(projectPath\)[\s\S]*path: projectPath/,
    ],
    ["legal/[kind]/page.tsx", /createCanonicalAlternates\(`\/legal\/\$\{resolved\.kind\}`\)/],
  ];

  for (const [relativePath, pattern] of expectations) {
    assert.match(readAppSource(relativePath), pattern, relativePath);
  }
});

test("member-only showcase screens are excluded from search", () => {
  for (const relativePath of [
    "(site)/events/project-showcase/my/page.tsx",
    "(site)/events/project-showcase/my/projects/[projectId]/page.tsx",
    "(site)/events/project-showcase/my/projects/[projectId]/edit/page.tsx",
    "(site)/events/project-showcase/projects/new/page.tsx",
  ]) {
    assert.match(
      readAppSource(relativePath),
      /robots: \{ index: false, follow: false \}/,
      relativePath,
    );
  }
});
