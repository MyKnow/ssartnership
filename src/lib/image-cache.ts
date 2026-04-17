const PROXY_PREFIX = "/api/image?url=";
const PARTNER_MEDIA_STORAGE_MARKER = "/storage/v1/object/public/partner-media/";
const REVIEW_MEDIA_STORAGE_MARKER = "/storage/v1/object/public/review-media/";
const warmedImageUrls = new Set<string>();
const pendingImagePreloads = new Map<string, Promise<void>>();

function shouldBypassProxy(src: string) {
  if (
    src.startsWith("/") ||
    src.startsWith("data:") ||
    src.startsWith("blob:")
  ) {
    return true;
  }

  try {
    const parsed = new URL(src);
    return (
      parsed.pathname.includes(PARTNER_MEDIA_STORAGE_MARKER) ||
      parsed.pathname.includes(REVIEW_MEDIA_STORAGE_MARKER)
    );
  } catch {
    return false;
  }
}

export function getCachedImageUrl(src?: string | null) {
  if (!src) {
    return "";
  }
  if (src.startsWith(PROXY_PREFIX) || shouldBypassProxy(src)) {
    return src;
  }
  return `${PROXY_PREFIX}${encodeURIComponent(src)}`;
}

export function preloadCachedImageUrl(src?: string | null) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const url = getCachedImageUrl(src);
  if (!url || warmedImageUrls.has(url)) {
    return Promise.resolve();
  }

  const pending = pendingImagePreloads.get(url);
  if (pending) {
    return pending;
  }

  const pendingPreload = new Promise<void>((resolve, reject) => {
    const image = new window.Image();
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      warmedImageUrls.add(url);
      resolve();
    };

    const fail = () => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error(`Failed to preload image: ${url}`));
    };

    image.decoding = "async";
    image.onload = finish;
    image.onerror = fail;
    image.src = url;

    if (typeof image.decode === "function") {
      void image.decode().then(finish).catch(() => undefined);
    }
  }).finally(() => {
    pendingImagePreloads.delete(url);
  });

  pendingImagePreloads.set(url, pendingPreload);
  return pendingPreload;
}

export function preloadCachedImageUrls(
  urls: Array<string | null | undefined>,
) {
  return Promise.allSettled(urls.map((url) => preloadCachedImageUrl(url)));
}

export function warmCachedImageUrl(src?: string | null) {
  void preloadCachedImageUrl(src).catch(() => undefined);
}

export function warmCachedImageUrls(urls: Array<string | null | undefined>) {
  void preloadCachedImageUrls(urls).catch(() => undefined);
}

export function isCachedImageUrlPreloaded(src?: string | null) {
  if (!src) {
    return false;
  }
  return warmedImageUrls.has(getCachedImageUrl(src));
}
