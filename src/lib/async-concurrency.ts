const MAX_ASYNC_CONCURRENCY = 32;

function normalizeConcurrency(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.min(Math.floor(value), MAX_ASYNC_CONCURRENCY));
}

/**
 * Runs an async side effect once per item without creating an unbounded number
 * of outbound requests. The shared cursor is advanced synchronously before a
 * worker yields, so each item is claimed by exactly one worker.
 */
export async function forEachWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>,
) {
  if (items.length === 0) {
    return;
  }

  const workerCount = Math.min(normalizeConcurrency(concurrency), items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index] as T;
      await task(item, index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

/**
 * Maps items with bounded concurrency while retaining the input order in the
 * returned array. This is useful for memory-heavy work where an unbounded
 * `Promise.all(items.map(...))` would otherwise process every item at once.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  await forEachWithConcurrency(items, concurrency, async (item, index) => {
    results[index] = await task(item, index);
  });
  return results;
}
