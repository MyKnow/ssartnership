import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { serializeJsonLd } from "@/lib/seo";

const sourceRoot = new URL("../src/", import.meta.url);
const repositoryRoot = fileURLToPath(new URL("..", sourceRoot));

async function findJsonLdSinkFiles(directory: URL): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches = await Promise.all(
    entries.map(async (entry) => {
      const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
      if (entry.isDirectory()) {
        return findJsonLdSinkFiles(entryUrl);
      }
      if (![".ts", ".tsx"].includes(extname(entry.name))) {
        return [];
      }
      const source = await readFile(entryUrl, "utf8");
      return source.includes("application/ld+json") ? [fileURLToPath(entryUrl)] : [];
    }),
  );
  return matches.flat();
}

test("JSON-LD 직렬화는 script 종료 문자열과 HTML 구문 문자를 데이터로 보존한다", () => {
  const input = {
    name: "</script><script>alert('json-ld')</script>",
    description: "A&B > C",
    separators: "\u2028\u2029",
  };

  const serialized = serializeJsonLd(input);

  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/u);
  assert.deepStrictEqual(JSON.parse(serialized), input);
});

test("모든 application/ld+json sink는 공용 HTML-safe 직렬화를 사용한다", async () => {
  const sinkFiles = await findJsonLdSinkFiles(sourceRoot);

  assert.ok(sinkFiles.length > 0);
  for (const absolutePath of sinkFiles) {
    const source = await readFile(absolutePath, "utf8");
    const displayPath = relative(repositoryRoot, absolutePath);
    assert.match(source, /serializeJsonLd/u, `${displayPath} must use serializeJsonLd`);
    assert.doesNotMatch(
      source,
      /__html:\s*JSON\.stringify\s*\(/u,
      `${displayPath} must not embed raw JSON.stringify output`,
    );
  }
});
