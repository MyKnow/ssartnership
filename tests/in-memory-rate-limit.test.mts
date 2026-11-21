import assert from "node:assert/strict";
import test from "node:test";

const { createInMemoryRateLimiter } = await import(
  new URL("../src/lib/in-memory-rate-limit.ts", import.meta.url).href
);

test("in-memory limiter allows the window budget, then blocks for blockMs", () => {
  const limiter = createInMemoryRateLimiter({
    windowMs: 1_000,
    maxAttempts: 3,
    blockMs: 5_000,
    maxBuckets: 10,
  });

  assert.deepEqual(limiter.consume("a", 0), { ok: true });
  assert.deepEqual(limiter.consume("a", 100), { ok: true });
  assert.deepEqual(limiter.consume("a", 200), { ok: true });
  assert.deepEqual(limiter.consume("a", 300), { ok: false, retryAfterSeconds: 5 });
  // 창이 끝나도 차단 기간 동안은 계속 거부한다.
  assert.deepEqual(limiter.consume("a", 2_300), { ok: false, retryAfterSeconds: 3 });
  // 차단이 끝나면 새 창에서 센다.
  assert.deepEqual(limiter.consume("a", 5_300), { ok: true });
  assert.deepEqual(limiter.consume("b", 300), { ok: true });
});

test("in-memory limiter resets the counter once the window elapses", () => {
  const limiter = createInMemoryRateLimiter({
    windowMs: 1_000,
    maxAttempts: 2,
    blockMs: 10_000,
    maxBuckets: 10,
  });

  assert.equal(limiter.consume("a", 0).ok, true);
  assert.equal(limiter.consume("a", 500).ok, true);
  assert.equal(limiter.consume("a", 1_000).ok, true);
  assert.equal(limiter.consume("a", 1_500).ok, true);
  assert.equal(limiter.consume("a", 1_900).ok, false);
});

test("in-memory limiter bounds memory by evicting expired and least recently used buckets", () => {
  const limiter = createInMemoryRateLimiter({
    windowMs: 1_000,
    maxAttempts: 1,
    blockMs: 60_000,
    maxBuckets: 3,
  });

  limiter.consume("expired", 0);
  limiter.consume("blocked", 0);
  assert.equal(limiter.consume("blocked", 0).ok, false);
  limiter.consume("recent", 1_500);
  assert.equal(limiter.size(), 3);

  // 새 키가 들어오면 만료된 버킷부터 버린다.
  limiter.consume("new", 1_600);
  assert.equal(limiter.size(), 3);
  assert.equal(limiter.consume("blocked", 1_700).ok, false);

  limiter.reset();
  assert.equal(limiter.size(), 0);
});

test("in-memory limiter rejects invalid configuration", () => {
  assert.throws(
    () => createInMemoryRateLimiter({ windowMs: 0, maxAttempts: 1, blockMs: 1, maxBuckets: 1 }),
    /in_memory_rate_limit_window_invalid/u,
  );
  assert.throws(
    () => createInMemoryRateLimiter({ windowMs: 1, maxAttempts: 1.5, blockMs: 1, maxBuckets: 1 }),
    /in_memory_rate_limit_max_attempts_invalid/u,
  );
});
