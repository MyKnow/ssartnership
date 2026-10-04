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
  assert.match(routeSource, /consumeImageProxyRequestQuota/u);
  assert.match(routeSource, /status:\s*429/u);
  assert.match(routeSource, /"Retry-After":\s*String\(quota\.retryAfterSeconds\)/u);
  assert.match(routeSource, /status:\s*503/u);
  assert.match(routeSource, /"x-content-type-options":\s*"nosniff"/u);
});
