import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";
import { classifyChanges } from "../scripts/lib/change-policy.mjs";
import { readSource } from "./support/read-source.ts";
import { unauthorized, forbidden, payloadTooLarge } from "../src/lib/http-responses.ts";

test("skill documentation selects standard verification even with security words in its path", () => {
  for (const path of [".agents/skills/github-actions-operations/SKILL.md", ".agents/skills/member-required-gate-redirects/SKILL.md"]) {
    assert.equal(classifyChanges([{ status: "M", path }]).level, "standard");
  }
});
test("every third-party action is pinned to an immutable SHA with a readable version", () => {
  const versions = new Map<string, string>();
  for (const name of readdirSync(new URL("../.github/workflows/", import.meta.url))) {
    const source = readSource(`.github/workflows/${name}`);
    for (const match of source.matchAll(/^\s*(?:-\s*)?uses:\s*(.+)$/gm)) {
      const value = match[1].trim();
      if (value.startsWith("./")) continue;
      const pin = /^([^@\s]+)@([a-f0-9]{40})\s+#\s+(v\d+(?:\.\d+){0,2})\s*$/.exec(value);
      assert.ok(pin, `${name}: ${value}`);
      const key = `${pin[1]}:${pin[3]}`;
      if (versions.has(key)) assert.equal(versions.get(key), pin[2]);
      versions.set(key, pin[2]);
    }
  }
});
test("safe response helpers preserve status and expose only a user-facing message", async () => {
  for (const [create, status] of [[unauthorized, 401], [forbidden, 403], [payloadTooLarge, 413]] as const) {
    const response = create();
    assert.equal(response.status, status);
    assert.deepEqual(Object.keys(await response.json()), ["message"]);
  }
});
