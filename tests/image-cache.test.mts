import assert from "node:assert/strict";
import test from "node:test";

const imageCacheModulePromise = import(
  new URL("../src/lib/image-cache.ts", import.meta.url).href
);

test("partner media storage urls bypass the proxy", async () => {
  const { getCachedImageUrl } = await imageCacheModulePromise;

  const storageUrl =
    "https://example.supabase.co/storage/v1/object/public/partner-media/partners/1/thumbnail/0-abc.webp";

  assert.equal(getCachedImageUrl(storageUrl), storageUrl);
});

test("external image urls still use the proxy", async () => {
  const { getCachedImageUrl } = await imageCacheModulePromise;

  assert.equal(
    getCachedImageUrl("https://images.example.com/banner.jpg"),
    "/api/image?url=https%3A%2F%2Fimages.example.com%2Fbanner.jpg",
  );
});

test("local and data urls pass through unchanged", async () => {
  const { getCachedImageUrl } = await imageCacheModulePromise;

  assert.equal(getCachedImageUrl("/icon-512.png"), "/icon-512.png");
  assert.equal(getCachedImageUrl("data:image/png;base64,abc"), "data:image/png;base64,abc");
  assert.equal(getCachedImageUrl("blob:abc"), "blob:abc");
});
