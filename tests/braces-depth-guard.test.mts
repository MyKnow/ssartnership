import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const braces = require("braces");
const compile = require("braces/lib/compile.js");
const expand = require("braces/lib/expand.js");
const stringify = require("braces/lib/stringify.js");

test("installed braces bounds deeply nested untrusted patterns before recursive walking", () => {
  assert.equal(require("braces/package.json").version, "3.0.3-depth-guard.0");
  const input = "{".repeat(4000) + "a,b" + "}".repeat(4000);
  for (const run of [braces.parse, braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => run(input), /nesting/i);
  }
});
test("AST entrypoints also reject a manually constructed deep tree", () => {
  let node = { type: "text", value: "a" } as Record<string, unknown>;
  for (let i = 0; i < 100; i++) node = { type: "root", nodes: [node] };
  for (const run of [compile, expand, stringify]) assert.throws(() => run(node), /nesting/i);
});
test("normal brace and range expansion keeps upstream behavior", () => {
  assert.deepEqual(braces.expand("src/{app,lib}/file.{ts,tsx}"), ["src/app/file.ts", "src/app/file.tsx", "src/lib/file.ts", "src/lib/file.tsx"]);
  assert.deepEqual(braces.expand("{1..3}"), ["1", "2", "3"]);
  assert.deepEqual(braces.expand("{a,{b,c}}"), ["a", "b", "c"]);
  assert.equal(braces.stringify(braces.parse("{a,b}")), "{a,b}");
});
