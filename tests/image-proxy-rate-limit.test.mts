import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const imageProxyRateLimitModulePromise = import(
  new URL("../src/lib/image-proxy-rate-limit.ts", import.meta.url).href
);
const clientIpModulePromise = import(
  new URL("../src/lib/client-ip.ts", import.meta.url).href
);

test("image proxy quota skips unresolved callers and internal hop addresses", async () => {
  const {
    consumeImageProxyRequestQuota,
    IMAGE_PROXY_RATE_LIMIT,
    resetImageProxyRateLimitForTests,
  } = await imageProxyRateLimitModulePromise;
  resetImageProxyRateLimitForTests();

  // 판정 불가(null·형식 오류)와 공개 주소가 아닌 내부 홉(loopback, relay 컨테이너가 있는
  // Docker 네트워크, LAN, tailnet, ULA)은 여러 요청이 한 값으로 모이므로 IP 쿼터를 세지 않는다.
  for (const ipAddress of [
    null,
    undefined,
    "unknown",
    "127.0.0.1",
    "::1",
    "172.19.0.4",
    "::ffff:172.19.0.4",
    "10.0.0.2",
    "192.168.1.182",
    "100.64.0.1",
    "fd00::4",
  ]) {
    for (let index = 0; index <= IMAGE_PROXY_RATE_LIMIT.maxAttempts; index += 1) {
      assert.deepEqual(
        consumeImageProxyRequestQuota({ ipAddress }, 1_000),
        { ok: true, scope: "untracked" },
        String(ipAddress),
      );
    }
  }
  resetImageProxyRateLimitForTests();
});

test("Next optimizer internal calls resolve to the relay hop and never share an IP bucket", async () => {
  const {
    consumeImageProxyRequestQuota,
    IMAGE_PROXY_RATE_LIMIT,
    resetImageProxyRateLimitForTests,
  } = await imageProxyRateLimitModulePromise;
  const { getClientIp } = await clientIpModulePromise;
  const before = process.env.SELF_HOST_MODE;
  resetImageProxyRateLimitForTests();

  try {
    process.env.SELF_HOST_MODE = "real";
    // /_next/image가 /api/image를 내부 호출하면 전달 헤더가 없어, Next 서버가 원 요청
    // 소켓의 접속 상대(relay 컨테이너)로 x-forwarded-for를 채운다. 모든 사용자의
    // 옵티마이저 호출이 이 값 하나로 모이므로 IP 쿼터를 적용하면 안 된다.
    const optimizerIp = getClientIp(new Headers({ "x-forwarded-for": "::ffff:172.19.0.4" }));
    assert.equal(optimizerIp, "172.19.0.4");
    for (let index = 0; index <= IMAGE_PROXY_RATE_LIMIT.maxAttempts * 2; index += 1) {
      assert.deepEqual(
        consumeImageProxyRequestQuota({ ipAddress: optimizerIp }, 5_000),
        { ok: true, scope: "untracked" },
      );
    }

    // relay를 거친 브라우저 직접 요청은 엣지가 기록한 공개 클라이언트 주소로 센다.
    const browserIp = getClientIp(
      new Headers({ "x-forwarded-for": "8.8.8.8, 192.168.1.5" }),
    );
    assert.deepEqual(
      consumeImageProxyRequestQuota({ ipAddress: browserIp }, 5_000),
      { ok: true, scope: "ip" },
    );
  } finally {
    if (before === undefined) delete process.env.SELF_HOST_MODE;
    else process.env.SELF_HOST_MODE = before;
    resetImageProxyRateLimitForTests();
  }
});

test("image proxy quota blocks one public IP after the window limit without touching other IPs", async () => {
  const {
    consumeImageProxyRequestQuota,
    IMAGE_PROXY_RATE_LIMIT,
    resetImageProxyRateLimitForTests,
  } = await imageProxyRateLimitModulePromise;
  resetImageProxyRateLimitForTests();

  const now = 10_000;
  for (let index = 0; index < IMAGE_PROXY_RATE_LIMIT.maxAttempts; index += 1) {
    assert.deepEqual(
      consumeImageProxyRequestQuota({ ipAddress: "8.8.8.8" }, now),
      { ok: true, scope: "ip" },
    );
  }

  const blocked = consumeImageProxyRequestQuota({ ipAddress: "8.8.8.8" }, now);
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
    consumeImageProxyRequestQuota({ ipAddress: "::ffff:8.8.8.8" }, now + 1_000).ok,
    false,
  );
  assert.deepEqual(
    consumeImageProxyRequestQuota({ ipAddress: "8.8.4.4" }, now),
    { ok: true, scope: "ip" },
  );
  assert.deepEqual(
    consumeImageProxyRequestQuota({ ipAddress: "2001:4860:4860::8888" }, now),
    { ok: true, scope: "ip" },
  );

  // 차단이 끝나면 새 창에서 다시 허용한다.
  assert.deepEqual(
    consumeImageProxyRequestQuota(
      { ipAddress: "8.8.8.8" },
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
