import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("server lib/API lint keeps floating promises and silent catch handlers visible", () => {
  const config = read("eslint.config.mjs");
  assert.match(config, /"@typescript-eslint\/no-floating-promises": "warn"/u);
  assert.match(config, /files: \["src\/lib\/\*\*\/\*\.\{ts,tsx\}", "src\/app\/api\/\*\*\/\*\.\{ts,tsx\}"\]/u);
  assert.match(config, /body\.name='undefined'/u);
  assert.match(config, /body\.raw='null'/u);
});
