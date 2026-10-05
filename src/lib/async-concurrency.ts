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

export type ConcurrencyLimiter = {
  /** 슬롯이 빌 때까지 FIFO로 기다린 뒤 task를 실행한다. 실패해도 슬롯을 돌려준다. */
  run<T>(task: () => Promise<T>): Promise<T>;
  readonly activeCount: number;
  readonly pendingCount: number;
};

/**
 * 호출 지점이 여러 요청에 흩어진 무거운 작업(예: 이미지 디코드)을 프로세스 단위로
 * 묶어 동시에 `concurrency`개까지만 실행한다. 대기열은 도착 순서를 지킨다.
 */
export function createConcurrencyLimiter(concurrency: number): ConcurrencyLimiter {
  const limit = normalizeConcurrency(concurrency);
  let active = 0;
  const waiting: Array<() => void> = [];

  const release = () => {
    const next = waiting.shift();
    if (next) {
      // 슬롯을 비우지 않고 다음 대기자에게 그대로 넘겨 새 호출이 끼어들지 못하게 한다.
      next();
      return;
    }
    active -= 1;
  };

  return {
    async run<T>(task: () => Promise<T>) {
      if (active >= limit) {
        await new Promise<void>((resolve) => {
          waiting.push(resolve);
        });
      } else {
        active += 1;
      }
      try {
        return await task();
      } finally {
        release();
      }
    },
    get activeCount() {
      return active;
    },
    get pendingCount() {
      return waiting.length;
    },
  };
}
