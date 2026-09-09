import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./e2e/partner-detail-introduction.spec.ts", import.meta.url),
  "utf8",
);

test("registers an independent partner-detail introduction test for each viewport", () => {
  assert.match(
    source,
    /viewports\.forEach\(\(viewport\) => \{\s*test\(\s*`puts the period in the header and keeps introduction and tags plain \(\$\{viewport\.width\}x\$\{viewport\.height\}\)`/,
  );
  assert.ok(!source.includes("for (const viewport of viewports)"));
});

test("keeps the viewport tests on the default timeout without retries", () => {
  assert.doesNotMatch(source, /\b(?:setTimeout|slow|retry|waitForTimeout)\b/);
  assert.doesNotMatch(source, /\b(?:timeout|retries)\s*:/);
});
