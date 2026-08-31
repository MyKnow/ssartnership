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
  assert.match(routeSource, /status:\s*503/u);
  assert.match(routeSource, /"x-content-type-options":\s*"nosniff"/u);
});
