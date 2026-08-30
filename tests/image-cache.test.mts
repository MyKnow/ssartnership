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

test("concurrent preloads for the same image share one in-flight request", async () => {
  const { preloadCachedImageUrl } = await imageCacheModulePromise;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const images: DeferredImage[] = [];

  class DeferredImage {
    decoding = "";
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;

    constructor() {
      images.push(this);
    }

    decode() {
      return new Promise<void>(() => undefined);
    }

    set src(_value: string) {}
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { Image: DeferredImage },
  });

  try {
    const first = preloadCachedImageUrl("https://images.example.com/shared.jpg");
    const second = preloadCachedImageUrl("https://images.example.com/shared.jpg");

    assert.equal(first, second);
    assert.equal(images.length, 1);

    images[0]?.onload?.();
    await Promise.all([first, second]);
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});

test("the warmed image registry evicts its oldest entry after 256 urls", async () => {
  const { isCachedImageUrlPreloaded, preloadCachedImageUrl } =
    await imageCacheModulePromise;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  class ImmediateImage {
    decoding = "";
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;

    decode() {
      return Promise.resolve();
    }

    set src(_value: string) {}
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { Image: ImmediateImage },
  });

  const firstUrl = "https://images.example.com/cache-limit-0.jpg";
  const latestUrl = "https://images.example.com/cache-limit-256.jpg";

  try {
    for (let index = 0; index <= 256; index += 1) {
      await preloadCachedImageUrl(
        `https://images.example.com/cache-limit-${index}.jpg`,
      );
    }

    assert.equal(isCachedImageUrlPreloaded(firstUrl), false);
    assert.equal(isCachedImageUrlPreloaded(latestUrl), true);
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});
