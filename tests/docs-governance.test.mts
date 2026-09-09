import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";

import {
  extractMarkdownLinks,
  parseDocumentFrontmatter,
  validateDocumentation,
} from "../scripts/check-docs.mjs";

const temporaryRoots: string[] = [];

afterEach(() => {
  while (temporaryRoots.length > 0) rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
});

function createRepository() {
  const root = mkdtempSync(join(tmpdir(), "ssartnership-docs-"));
  temporaryRoots.push(root);
  mkdirSync(join(root, "docs"), { recursive: true });
  return root;
}

function writeDocument(root: string, path: string, body: string) {
  const pathname = join(root, path);
  mkdirSync(dirname(pathname), { recursive: true });
  writeFileSync(pathname, body, "utf8");
}

const indexFrontmatter = `---
title: Test map
type: index
status: current
authority: normative
---`;

test("parses the scalar documentation frontmatter contract", () => {
  const parsed = parseDocumentFrontmatter(`${indexFrontmatter}\n\n# Test map\n`);
  assert.deepEqual(parsed.data, {
    title: "Test map",
    type: "index",
    status: "current",
    authority: "normative",
  });
  assert.match(parsed.body, /^\n?# Test map/);
});

test("extracts repository links whose paths contain route-group parentheses", () => {
  assert.deepEqual(
    extractMarkdownLinks("[page](../src/app/(site)/page.tsx)"),
    [{ target: "../src/app/(site)/page.tsx", offset: 5 }],
  );
});

test("accepts a reachable normative map and repository-relative source link", () => {
  const root = createRepository();
  writeFileSync(join(root, "source.ts"), "export {};\n", "utf8");
  writeDocument(root, "docs/index.md", `${indexFrontmatter}\n\n# Test map\n\n[Contract](./contract.md)\n`);
  writeDocument(root, "docs/contract.md", `---
title: Contract
type: requirement
status: current
authority: normative
---

# Contract

[Source](../source.ts)
`);
  assert.deepEqual(validateDocumentation({ rootDir: root }).errors, []);
});

test("rejects broken links, personal absolute paths, and unreachable normative documents", () => {
  const root = createRepository();
  writeDocument(root, "docs/index.md", `${indexFrontmatter}\n\n# Test map\n`);
  writeDocument(root, "docs/orphan.md", `---
title: Orphan
type: requirement
status: current
authority: normative
---

# Orphan

[Missing](./missing.md)

/Users/example/project/file.ts
`);
  const errors = validateDocumentation({ rootDir: root }).errors.join("\n");
  assert.match(errors, /개인 절대 경로/);
  assert.match(errors, /링크 대상이 없습니다/);
  assert.match(errors, /도달할 수 없는/);
});
