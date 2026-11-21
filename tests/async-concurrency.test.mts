import assert from "node:assert/strict";
import test from "node:test";
import {
  createConcurrencyLimiter,
  forEachWithConcurrency,
  mapWithConcurrency,
} from "../src/lib/async-concurrency.ts";

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

test("mapWithConcurrency preserves input order while bounding active work", async () => {
  const items = [4, 3, 2, 1];
  let active = 0;
  let maxActive = 0;

  const results = await mapWithConcurrency(items, 2, async (item) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, item));
    active -= 1;
    return `item-${item}`;
  });

  assert.equal(maxActive, 2);
  assert.deepEqual(results, ["item-4", "item-3", "item-2", "item-1"]);
});

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });
  return { promise, resolve, reject };
}

test("createConcurrencyLimiter bounds active tasks across callers and runs waiters in FIFO order", async () => {
  const limiter = createConcurrencyLimiter(2);
  const gates = Array.from({ length: 5 }, () => deferred());
  const started: number[] = [];
  const runs = gates.map((gate, index) =>
    limiter.run(async () => {
      started.push(index);
      await gate.promise;
      return index;
    }),
  );

  await Promise.resolve();
  assert.deepEqual(started, [0, 1]);
  assert.equal(limiter.activeCount, 2);
  assert.equal(limiter.pendingCount, 3);

  gates[1]!.resolve();
  await runs[1];
  await Promise.resolve();
  assert.deepEqual(started, [0, 1, 2]);
  assert.equal(limiter.activeCount, 2);
  assert.equal(limiter.pendingCount, 2);

  for (const gate of gates) {
    gate.resolve();
  }
  assert.deepEqual(await Promise.all(runs), [0, 1, 2, 3, 4]);
  assert.deepEqual(started, [0, 1, 2, 3, 4]);
  assert.equal(limiter.activeCount, 0);
  assert.equal(limiter.pendingCount, 0);
});

test("createConcurrencyLimiter releases the slot when a task fails or throws synchronously", async () => {
  const limiter = createConcurrencyLimiter(1);

  await assert.rejects(
    limiter.run(async () => {
      throw new Error("async failure");
    }),
    /async failure/,
  );
  await assert.rejects(
    limiter.run((() => {
      throw new Error("sync failure");
    }) as () => Promise<never>),
    /sync failure/,
  );
  assert.equal(await limiter.run(async () => "ok"), "ok");
  assert.equal(limiter.activeCount, 0);
});

test("createConcurrencyLimiter normalizes invalid limits to one slot", async () => {
  const limiter = createConcurrencyLimiter(Number.NaN);
  const gate = deferred();
  const first = limiter.run(() => gate.promise);
  const second = limiter.run(async () => "second");

  await Promise.resolve();
  assert.equal(limiter.activeCount, 1);
  assert.equal(limiter.pendingCount, 1);
  gate.resolve();
  await first;
  assert.equal(await second, "second");
});
