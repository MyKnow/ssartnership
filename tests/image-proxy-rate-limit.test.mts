import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const imageProxyRateLimitModulePromise = import(
  new URL("../src/lib/image-proxy-rate-limit.ts", import.meta.url).href
);

test("image proxy quota skips the IP bucket when no trusted client IP is available", async () => {
  const {
    consumeImageProxyRequestQuota,
    IMAGE_PROXY_RATE_LIMIT,
    resetImageProxyRateLimitForTests,
  } = await imageProxyRateLimitModulePromise;
  resetImageProxyRateLimitForTests();

  // Next 이미지 옵티마이저 내부 호출은 전달 헤더가 없어 언제나 null이다.
  for (let index = 0; index < IMAGE_PROXY_RATE_LIMIT.maxAttempts * 2; index += 1) {
    assert.deepEqual(
      consumeImageProxyRequestQuota({ ipAddress: null }, 1_000),
      { ok: true, scope: "untracked" },
    );
  }
  assert.deepEqual(
    consumeImageProxyRequestQuota({ ipAddress: "unknown" }, 1_000),
    { ok: true, scope: "untracked" },
  );
  resetImageProxyRateLimitForTests();
});

test("image proxy quota blocks one IP after the window limit without touching other IPs", async () => {
  const {
    consumeImageProxyRequestQuota,
    IMAGE_PROXY_RATE_LIMIT,
    resetImageProxyRateLimitForTests,
  } = await imageProxyRateLimitModulePromise;
  resetImageProxyRateLimitForTests();

  const now = 10_000;
  for (let index = 0; index < IMAGE_PROXY_RATE_LIMIT.maxAttempts; index += 1) {
    assert.deepEqual(
      consumeImageProxyRequestQuota({ ipAddress: "203.0.113.12" }, now),
      { ok: true, scope: "ip" },
    );
  }

  const blocked = consumeImageProxyRequestQuota({ ipAddress: "203.0.113.12" }, now);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.equal(blocked.code, "blocked");
    assert.equal(
      blocked.retryAfterSeconds,
      Math.ceil(IMAGE_PROXY_RATE_LIMIT.blockMs / 1_000),
    );
  }

  // 같은 주소의 다른 표기도 같은 버킷이다.
  assert.equal(
    consumeImageProxyRequestQuota({ ipAddress: "::ffff:203.0.113.12" }, now + 1_000).ok,
    false,
  );
  assert.deepEqual(
    consumeImageProxyRequestQuota({ ipAddress: "203.0.113.13" }, now),
    { ok: true, scope: "ip" },
  );

  // 차단이 끝나면 새 창에서 다시 허용한다.
  assert.deepEqual(
    consumeImageProxyRequestQuota(
      { ipAddress: "203.0.113.12" },
      now + IMAGE_PROXY_RATE_LIMIT.blockMs,
    ),
    { ok: true, scope: "ip" },
  );
  resetImageProxyRateLimitForTests();
});

test("image proxy quota keys hash the caller IP", async () => {
  const { getImageProxyRateLimitKey } = await imageProxyRateLimitModulePromise;

  const key = getImageProxyRateLimitKey("203.0.113.12");
  assert.match(key, /^public-image-proxy:ip:[0-9a-f]{64}$/u);
  assert.doesNotMatch(key, /203\.0\.113\.12/u);
  assert.equal(getImageProxyRateLimitKey("::FFFF:203.0.113.12"), key);
});

test("image proxy quota no longer round-trips to the database per request", () => {
  const source = readFileSync(
    new URL("../src/lib/image-proxy-rate-limit.ts", import.meta.url),
    "utf8",
  );
  const routeSource = readFileSync(
    new URL("../src/app/api/image/route.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /@\/lib\/rate-limit"|getBlockingState|recordAttemptBatch|suggestion_attempts/u);
  assert.match(source, /createInMemoryRateLimiter/u);
  assert.doesNotMatch(routeSource, /getRequestLogContext|await consumeImageProxyRequestQuota/u);
  assert.match(routeSource, /consumeImageProxyRequestQuota\(\{\s*ipAddress:\s*getClientIp\(request\.headers\)/u);
});
