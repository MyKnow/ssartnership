import assert from "node:assert/strict";
import test from "node:test";
import { withAdminReadModelTimeout } from "../src/lib/admin-read-model-timeout.ts";

test("read-model timeout resolves the safe fallback and does not wait for a slow query", async () => {
  const startedAt = Date.now();
  const result = await withAdminReadModelTimeout(
    new Promise<string>((resolve) => {
      setTimeout(() => resolve("late result"), 100);
    }),
    "safe fallback",
    10,
  );

  assert.equal(result, "safe fallback");
  assert.ok(Date.now() - startedAt < 80);
});

test("read-model failure resolves the safe fallback without exposing the rejection", async () => {
  const result = await withAdminReadModelTimeout(
    Promise.reject(new Error("internal database error")),
    { state: "error" },
    100,
  );

  assert.deepEqual(result, { state: "error" });
});

test("fast read-model results win before the fallback timer", async () => {
  const result = await withAdminReadModelTimeout(
    Promise.resolve("ready"),
    "fallback",
    100,
  );

  assert.equal(result, "ready");
});
