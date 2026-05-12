import assert from "node:assert/strict";
import test from "node:test";

const imageCacheModulePromise = import(
  new URL("../src/lib/image-cache.ts", import.meta.url).href
);

test("remote storage urls use the proxy so unconfigured hosts still render", async () => {
  const { getCachedImageUrl, isProxiedCachedImageUrl } = await imageCacheModulePromise;

  const storageUrl =
    "https://example.supabase.co/storage/v1/object/public/partner-media/partners/1/thumbnail/0-abc.webp";
  const cachedUrl = getCachedImageUrl(storageUrl);

  assert.equal(
    cachedUrl,
    "/api/image?url=https%3A%2F%2Fexample.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fpartner-media%2Fpartners%2F1%2Fthumbnail%2F0-abc.webp",
  );
  assert.equal(isProxiedCachedImageUrl(cachedUrl), true);
});

test("external image urls still use the proxy", async () => {
  const { getCachedImageUrl, isProxiedCachedImageUrl } = await imageCacheModulePromise;

  const proxiedUrl = getCachedImageUrl("https://images.example.com/banner.jpg");

  assert.equal(proxiedUrl, "/api/image?url=https%3A%2F%2Fimages.example.com%2Fbanner.jpg");
  assert.equal(isProxiedCachedImageUrl(proxiedUrl), true);
});

test("local and data urls pass through unchanged", async () => {
  const { getCachedImageUrl, isProxiedCachedImageUrl } = await imageCacheModulePromise;

  assert.equal(getCachedImageUrl("/icon-512.png"), "/icon-512.png");
  assert.equal(getCachedImageUrl("data:image/png;base64,abc"), "data:image/png;base64,abc");
  assert.equal(getCachedImageUrl("blob:abc"), "blob:abc");
  assert.equal(isProxiedCachedImageUrl("/icon-512.png"), false);
});
