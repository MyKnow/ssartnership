import assert from "node:assert/strict";
import test from "node:test";
import { expectNoError, SupabaseWriteFailedError } from "../src/lib/expect-no-error.ts";

test("expectNoError logs a returned Supabase error once and resolves false", async (t) => {
  const lines: string[] = [];
  t.mock.method(console, "error", (line: unknown) => { lines.push(String(line)); });
  assert.equal(await expectNoError(Promise.resolve({ error: null }), "[scope] write failed"), true);
  assert.equal(await expectNoError(Promise.resolve(null), "[scope] write failed"), true);
  assert.equal(
    await expectNoError(
      Promise.resolve({ error: { code: "23505", message: "duplicate", details: "Key (email)=(private@example.test)" } }),
      "[scope] write failed",
      { properties: { requestId: "request-1" } },
    ),
    false,
  );
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.event, "[scope] write failed");
  assert.deepEqual(entry.error, { code: "23505", message: "duplicate" });
  assert.deepEqual(entry.properties, { requestId: "request-1" });
  assert.doesNotMatch(lines[0], /private@example/u);
});

test("expectNoError treats a rejected builder as a failure and supports throw mode", async (t) => {
  const lines: string[] = [];
  t.mock.method(console, "error", (line: unknown) => { lines.push(String(line)); });
  assert.equal(await expectNoError(Promise.reject(new Error("network down")), "[scope] write failed"), false);
  await assert.rejects(
    expectNoError(Promise.resolve({ error: { message: "denied" } }), "[scope] required write failed", { mode: "throw" }),
    (error: unknown) => error instanceof SupabaseWriteFailedError && error.event === "[scope] required write failed" && error.message === "supabase_write_failed",
  );
  assert.equal(lines.length, 2);
});

test("expectNoError accepts PromiseLike Supabase builders", async () => {
  const builder = { then: (resolve: (value: { error: null }) => void) => resolve({ error: null }) };
  assert.equal(await expectNoError(builder as PromiseLike<{ error: null }>, "[scope] write failed"), true);
});
