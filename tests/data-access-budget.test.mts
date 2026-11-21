import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../src");
const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory() ? walk(resolve(directory, entry.name)) : [resolve(directory, entry.name)]);

test("direct table access outside shared repositories stays within the reviewed D5 budget", () => {
  const files = walk(root).filter((file) => /\.tsx?$/.test(file)
    && !file.startsWith(resolve(root, "lib/repositories") + sep)
    && /\.from\(["'][a-z_]+["']\)/.test(readFileSync(file, "utf8")));
  assert.ok(files.length <= 124, `direct table access: ${files.length} exceeds the 124-file budget`);
});
