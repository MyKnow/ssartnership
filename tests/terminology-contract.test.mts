import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["src/app", "src/components", "src/lib"];
const legacyTerms = /협력사|업체|브랜드/;

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(absolutePath);
    }
    return /\.(?:ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });
}

function isIntentionalLegacyAlias(relativePath: string, line: string) {
  if (relativePath === "src/lib/admin-partner-file-import.server.ts") {
    return /^\s*(?:브랜드명|"브랜드 전화번호"|협력사명|"협력사 설명"):\s*"/.test(
      line,
    );
  }
  if (relativePath === "src/lib/site.ts") {
    return /^\s*"제휴 (?:업체|브랜드)",\s*$/.test(line);
  }
  return false;
}

test("user-facing source uses the partner company and partnership-place terminology", () => {
  const violations = sourceRoots
    .flatMap((sourceRoot) => collectSourceFiles(path.join(repoRoot, sourceRoot)))
    .flatMap((absolutePath) => {
      const relativePath = path.relative(repoRoot, absolutePath);
      return readFileSync(absolutePath, "utf8")
        .split("\n")
        .map((line, index) => ({ relativePath, line, lineNumber: index + 1 }))
        .filter(
          ({ relativePath: file, line }) =>
            legacyTerms.test(line) && !isIntentionalLegacyAlias(file, line),
        );
    });

  assert.deepStrictEqual(
    violations,
    [],
    `legacy UI terminology remains:\n${violations
      .map(({ relativePath, lineNumber, line }) =>
        `${relativePath}:${lineNumber} ${line.trim()}`,
      )
      .join("\n")}`,
  );
});
