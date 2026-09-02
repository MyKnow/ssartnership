import assert from "node:assert/strict";
import test from "node:test";

const imageProxyRateLimitModulePromise = import(
  new URL("../src/lib/image-proxy-rate-limit.ts", import.meta.url).href
);

test("image proxy quota uses a durable shared bucket when no trusted IP is available", async () => {
  const { consumeImageProxyRequestQuota, getImageProxyRateLimitKey } =
    await imageProxyRateLimitModulePromise;
  const key = getImageProxyRateLimitKey("unknown");

  const result = await consumeImageProxyRequestQuota(
    { ipAddress: null },
    {
      getBlockingState: async (keys: string[]) => {
        assert.deepEqual(keys, [key]);
        return { ok: true, blocked: false } as const;
      },
      recordAttemptBatch: async (keys: string[], success: boolean) => {
        assert.deepEqual(keys, [key]);
        assert.equal(success, false);
        return { ok: true, attemptedCount: 1, failedCount: 0 } as const;
      },
    },
  );

  assert.deepEqual(result, { ok: true });
});

test("image proxy quota returns blocked with a retry hint when the key is already blocked", async () => {
  const { consumeImageProxyRequestQuota, getImageProxyRateLimitKey } =
    await imageProxyRateLimitModulePromise;

  const key = getImageProxyRateLimitKey("203.0.113.12");
  let recordCalled = false;
  const result = await consumeImageProxyRequestQuota(
    { ipAddress: "203.0.113.12" },
    {
      getBlockingState: async (keys: string[]) => {
        assert.deepEqual(keys, [key]);
        return {
          ok: true,
          blocked: true,
          identifier: key,
          blockedUntil: new Date(Date.now() + 60_000).toISOString(),
        } as const;
      },
      recordAttemptBatch: async () => {
        recordCalled = true;
        return { ok: true, attemptedCount: 1, failedCount: 0 } as const;
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "blocked");
  if (result.code === "blocked") {
    assert.ok(result.retryAfterSeconds >= 59);
    assert.ok(result.retryAfterSeconds <= 60);
  }
  assert.equal(recordCalled, false);
});

test("image proxy quota records a request and rechecks the block state", async () => {
  const { consumeImageProxyRequestQuota, getImageProxyRateLimitKey } =
    await imageProxyRateLimitModulePromise;

  const key = getImageProxyRateLimitKey("203.0.113.12");
  let calls = 0;
  const result = await consumeImageProxyRequestQuota(
    { ipAddress: "203.0.113.12" },
    {
      getBlockingState: async (keys: string[]) => {
        assert.deepEqual(keys, [key]);
        calls += 1;
        if (calls === 1) {
          return { ok: true, blocked: false } as const;
        }
        return {
          ok: true,
          blocked: true,
          identifier: key,
          blockedUntil: new Date(Date.now() + 60_000).toISOString(),
        } as const;
      },
      recordAttemptBatch: async (keys: string[], success: boolean) => {
        assert.deepEqual(keys, [key]);
        assert.equal(success, false);
        return { ok: true, attemptedCount: 1, failedCount: 0 } as const;
      },
    },
  );

  assert.equal(calls, 2);
  assert.equal(result.ok, false);
  assert.equal(result.code, "blocked");
  if (result.code === "blocked") {
    assert.ok(result.retryAfterSeconds >= 59);
    assert.ok(result.retryAfterSeconds <= 60);
  }
});

test("image proxy quota stores a hashed caller key", async () => {
  const { getImageProxyRateLimitKey } = await imageProxyRateLimitModulePromise;

  const key = getImageProxyRateLimitKey("203.0.113.12");
  assert.match(key, /^public-image-proxy:ip:[0-9a-f]{64}$/u);
  assert.doesNotMatch(key, /203\.0\.113\.12/u);
});

test("image proxy quota reports unavailable when persistence fails", async () => {
  const { consumeImageProxyRequestQuota, getImageProxyRateLimitKey } =
    await imageProxyRateLimitModulePromise;

  const key = getImageProxyRateLimitKey("203.0.113.12");
  const result = await consumeImageProxyRequestQuota(
    { ipAddress: "203.0.113.12" },
    {
      getBlockingState: async (keys: string[]) => {
        assert.deepEqual(keys, [key]);
        return { ok: true, blocked: false } as const;
      },
      recordAttemptBatch: async () =>
        ({
          ok: false,
          code: "rate_limit_storage_failed",
          attemptedCount: 1,
          failedCount: 1,
        }) as const,
    },
  );

  assert.deepEqual(result, { ok: false, code: "unavailable" });
});

test("image proxy quota succeeds when the request stays within the shared window", async () => {
  const { consumeImageProxyRequestQuota, getImageProxyRateLimitKey } =
    await imageProxyRateLimitModulePromise;

  const key = getImageProxyRateLimitKey("203.0.113.12");
  let calls = 0;
  const result = await consumeImageProxyRequestQuota(
    { ipAddress: "203.0.113.12" },
    {
      getBlockingState: async (keys: string[]) => {
        assert.deepEqual(keys, [key]);
        calls += 1;
        return { ok: true, blocked: false } as const;
      },
      recordAttemptBatch: async (keys: string[], success: boolean) => {
        assert.deepEqual(keys, [key]);
        assert.equal(success, false);
        return { ok: true, attemptedCount: 1, failedCount: 0 } as const;
      },
    },
  );

  assert.equal(calls, 2);
  assert.deepEqual(result, { ok: true });
});
