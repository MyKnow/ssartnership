import assert from "node:assert/strict";
import test from "node:test";

const imageProxyModulePromise = import(
  new URL("../src/lib/image-proxy.ts", import.meta.url).href
);

test("public ip checks block loopback and private ranges", async () => {
  const { isPublicIpAddress } = await imageProxyModulePromise;

  assert.equal(isPublicIpAddress("127.0.0.1"), false);
  assert.equal(isPublicIpAddress("10.0.0.1"), false);
  assert.equal(isPublicIpAddress("100.64.0.1"), false);
  assert.equal(isPublicIpAddress("169.254.1.1"), false);
  assert.equal(isPublicIpAddress("172.16.0.1"), false);
  assert.equal(isPublicIpAddress("192.168.0.1"), false);
  assert.equal(isPublicIpAddress("::1"), false);
  assert.equal(isPublicIpAddress("::ffff:127.0.0.1"), false);
  assert.equal(isPublicIpAddress("::ffff:7f00:1"), false);
  assert.equal(isPublicIpAddress("fc00::1"), false);
  assert.equal(isPublicIpAddress("fe80::1"), false);
  assert.equal(isPublicIpAddress("ff02::1"), false);
});

test("public ip checks block IPv6 transition prefixes that embed IPv4 targets", async () => {
  const { isPublicIpAddress } = await imageProxyModulePromise;

  // NAT64 well-known(64:ff9b::/96)·local-use(64:ff9b:1::/48)
  assert.equal(isPublicIpAddress("64:ff9b::7f00:1"), false);
  assert.equal(isPublicIpAddress("64:ff9b::a00:1"), false);
  assert.equal(isPublicIpAddress("64:ff9b::808:808"), false);
  assert.equal(isPublicIpAddress("64:ff9b::192.168.0.1"), false);
  assert.equal(isPublicIpAddress("64:ff9b:1::a00:1"), false);
  // 6to4(2002::/16)
  assert.equal(isPublicIpAddress("2002:7f00:1::1"), false);
  assert.equal(isPublicIpAddress("2002:c0a8:1::"), false);
  // Teredo(2001::/32)
  assert.equal(isPublicIpAddress("2001:0:4136:e378:8000:63bf:3fff:fdd2"), false);
  assert.equal(isPublicIpAddress("2001::1"), false);
  // SIIT IPv4-translated(::ffff:0:0:0/96)는 내장 주소가 공개 IPv4여도 차단한다.
  assert.equal(isPublicIpAddress("::ffff:0:7f00:1"), false);
  assert.equal(isPublicIpAddress("::ffff:0:a00:1"), false);
  assert.equal(isPublicIpAddress("::ffff:0:8.8.8.8"), false);
  // IPv4-mapped(::ffff:0:0/96)는 기존처럼 내장 IPv4 기준으로 판정한다.
  assert.equal(isPublicIpAddress("::ffff:127.0.0.1"), false);
  assert.equal(isPublicIpAddress("::ffff:8.8.8.8"), true);
  // 인접한 공개 대역은 그대로 허용한다.
  assert.equal(isPublicIpAddress("2001:4860:4860::8844"), true);
  assert.equal(isPublicIpAddress("64:ff9c::1"), true);
});

test("public ip checks allow routable public addresses", async () => {
  const { isPublicIpAddress } = await imageProxyModulePromise;

  assert.equal(isPublicIpAddress("8.8.8.8"), true);
  assert.equal(isPublicIpAddress("1.1.1.1"), true);
  assert.equal(isPublicIpAddress("2001:4860:4860::8888"), true);
});

test("public image proxy allowlist accepts raster MIME types and normalizes parameters", async () => {
  const {
    PUBLIC_RASTER_IMAGE_CONTENT_TYPES,
    resolveAllowedImageContentType,
  } = await imageProxyModulePromise;

  assert.equal(
    resolveAllowedImageContentType(
      "image/png; charset=binary",
      PUBLIC_RASTER_IMAGE_CONTENT_TYPES,
    ),
    "image/png",
  );
  assert.equal(
    resolveAllowedImageContentType(
      "IMAGE/WEBP",
      PUBLIC_RASTER_IMAGE_CONTENT_TYPES,
    ),
    "image/webp",
  );
  assert.equal(
    resolveAllowedImageContentType(
      "image/svg+xml",
      PUBLIC_RASTER_IMAGE_CONTENT_TYPES,
    ),
    null,
  );
  assert.equal(
    resolveAllowedImageContentType(
      "image/svg+xml; charset=utf-8",
      PUBLIC_RASTER_IMAGE_CONTENT_TYPES,
    ),
    null,
  );
  assert.equal(
    resolveAllowedImageContentType(
      "application/xml",
      PUBLIC_RASTER_IMAGE_CONTENT_TYPES,
    ),
    null,
  );
  assert.equal(
    resolveAllowedImageContentType(
      "image/png, image/svg+xml",
      PUBLIC_RASTER_IMAGE_CONTENT_TYPES,
    ),
    null,
  );
});

test("server-side image fetch keeps SVG input available when no public raster policy is requested", async () => {
  const { resolveAllowedImageContentType } = await imageProxyModulePromise;

  assert.equal(
    resolveAllowedImageContentType("image/svg+xml; charset=utf-8"),
    "image/svg+xml",
  );
});

test("public image proxy only allows the protocol default ports", async () => {
  const { resolvePublicImageTargetPort } = await imageProxyModulePromise;

  assert.equal(resolvePublicImageTargetPort(new URL("https://example.com/image.png")), undefined);
  assert.equal(resolvePublicImageTargetPort(new URL("https://example.com:443/image.png")), undefined);
  assert.equal(resolvePublicImageTargetPort(new URL("http://example.com:80/image.png")), undefined);
  assert.throws(
    () => resolvePublicImageTargetPort(new URL("https://example.com:8443/image.png")),
    /Unsupported port/u,
  );
  assert.throws(
    () => resolvePublicImageTargetPort(new URL("http://example.com:8080/image.png")),
    /Unsupported port/u,
  );
  assert.throws(
    () => resolvePublicImageTargetPort(new URL("ftp://example.com/image.png")),
    /Unsupported protocol/u,
  );
});

test("public image route applies the raster policy and disables MIME sniffing", async () => {
  const routeSource = await import("node:fs/promises").then(({ readFile }) =>
    readFile(
      new URL("../src/app/api/image/route.ts", import.meta.url),
      "utf8",
    ),
  );

  assert.match(
    routeSource,
    /fetchPublicImage\(parsed,\s*\{[\s\S]*allowedContentTypes:\s*PUBLIC_RASTER_IMAGE_CONTENT_TYPES[\s\S]*\}\)/u,
  );
  assert.match(
    routeSource,
    /maxBytes:\s*PUBLIC_IMAGE_PROXY_FETCH_LIMITS\.maxBytes[\s\S]*timeoutMs:\s*PUBLIC_IMAGE_PROXY_FETCH_LIMITS\.timeoutMs/u,
  );
  assert.match(routeSource, /consumeImageProxyRequestQuota/u);
  assert.match(routeSource, /status:\s*429/u);
  assert.match(routeSource, /"Retry-After":\s*String\(quota\.retryAfterSeconds\)/u);
  assert.match(routeSource, /"x-content-type-options":\s*"nosniff"/u);
});

test("public image proxy fetch limits stay within the server-wide image bounds", async () => {
  const {
    PUBLIC_IMAGE_PROXY_FETCH_LIMITS,
    resolveImageFetchTimeoutMs,
  } = await imageProxyModulePromise;
  const { IMAGE_FETCH_TIMEOUT_MS, MAX_IMAGE_BYTES } = await import(
    new URL("../src/lib/image-proxy/shared.ts", import.meta.url).href
  );

  assert.ok(PUBLIC_IMAGE_PROXY_FETCH_LIMITS.maxBytes <= MAX_IMAGE_BYTES);
  assert.ok(PUBLIC_IMAGE_PROXY_FETCH_LIMITS.timeoutMs <= IMAGE_FETCH_TIMEOUT_MS);
  assert.equal(resolveImageFetchTimeoutMs(undefined), IMAGE_FETCH_TIMEOUT_MS);
  assert.equal(resolveImageFetchTimeoutMs(2_000), 2_000);
  for (const invalid of [0, -1, 1.5, IMAGE_FETCH_TIMEOUT_MS + 1]) {
    assert.throws(() => resolveImageFetchTimeoutMs(invalid), /Invalid image timeout/u);
  }
});
