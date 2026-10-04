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

test("validates links and personal paths in root knowledge files outside docs", () => {
  const root = createRepository();
  writeDocument(root, "docs/index.md", `${indexFrontmatter}\n\n# Test map\n`);
  writeDocument(root, "README.md", "# Readme\n\n[Map](./docs/index.md)\n[Gone](./docs/missing.md)\n");
  writeDocument(root, "AGENTS.md", "# Agents\n\nSee /Users/someone/project/notes.md\n");
  writeDocument(root, ".agents/skills/example/SKILL.md", "# Skill\n\n[Outside](../../../../outside.md)\n");

  const result = validateDocumentation({ rootDir: root });
  const errors = result.errors.join("\n");

  assert.deepEqual(result.rootKnowledgeFiles.map((path) => path.slice(root.length + 1)).sort(), [
    ".agents/skills/example/SKILL.md",
    "AGENTS.md",
    "README.md",
  ]);
  assert.match(errors, /README\.md:4: 링크 대상이 없습니다: \.\/docs\/missing\.md/);
  assert.doesNotMatch(errors, /README\.md:3/);
  assert.match(errors, /AGENTS\.md: macOS 개인 절대 경로/);
  assert.match(errors, /SKILL\.md:3: 저장소 밖 링크입니다/);
});

test("root knowledge files without frontmatter are not treated as docs", () => {
  const root = createRepository();
  writeDocument(root, "docs/index.md", `${indexFrontmatter}\n\n# Test map\n`);
  writeDocument(root, "README.md", "# Readme\n\n[Map](./docs/index.md)\n");

  const result = validateDocumentation({ rootDir: root });
  assert.deepEqual(result.errors, []);
  assert.equal(result.documents.length, 1);
});
