import assert from "node:assert/strict";
import test from "node:test";
import { forEachWithConcurrency } from "../src/lib/async-concurrency.ts";

test("forEachWithConcurrency processes each item once within the requested limit", async () => {
  const items = Array.from({ length: 12 }, (_, index) => index);
  const processed: number[] = [];
  let active = 0;
  let maxActive = 0;

  await forEachWithConcurrency(items, 3, async (item) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    processed.push(item);
    active -= 1;
  });

  assert.equal(maxActive, 3);
  assert.deepEqual(processed.toSorted((left, right) => left - right), items);
});

test("forEachWithConcurrency falls back to one worker for invalid limits", async () => {
  let active = 0;
  let maxActive = 0;

  await forEachWithConcurrency([1, 2, 3], Number.NaN, async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await Promise.resolve();
    active -= 1;
  });

  assert.equal(maxActive, 1);
});
