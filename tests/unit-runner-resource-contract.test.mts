import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("unit workers fit the two-CPU release gate without retries or longer test deadlines", () => {
  const config = readFileSync(new URL("../vitest.config.ts", import.meta.url), "utf8");
  const unit = config.match(/name: "unit",([\s\S]*?)include: \["tests\/unit\/\*\*\/\*\.test\.ts"\]/u)?.[1];
  assert.ok(unit);
  assert.match(unit, /maxWorkers: 2/u);
  assert.match(unit, /testTimeout: 5_000/u);
  assert.match(unit, /retry: 0/u);
});

test("member lifecycle imports cannot resume against a later case's mock", () => {
  const source = readFileSync(new URL("./unit/member-lifecycle.test.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ anonymizeDeletedMember \} from/u);
  assert.match(source, /vi\.hoisted/u);
  assert.doesNotMatch(source, /await import|vi\.resetModules/u);
});

test("notification module initialization is awaited before case-specific RPC mocks", () => {
  const source = readFileSync(new URL("./unit/notification-preferences.test.ts", import.meta.url), "utf8");
  assert.match(source, /beforeEach\(async \(\) => \{[\s\S]*?preferences = await loadModule\(\)/u);
  assert.equal(source.match(/await loadModule\(\)/gu)?.length, 1);
  assert.equal(source.match(/const \{ updateMemberNotificationPreferences \} = preferences/gu)?.length, 2);
});
