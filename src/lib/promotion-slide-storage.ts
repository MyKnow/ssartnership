import { sanitizeHttpUrl } from "@/lib/validation";

export const PROMOTION_SLIDES_BUCKET = "promotion-slides";

export function buildPromotionSlideStoragePath(index: number, extension = "webp") {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  const suffix = cryptoRandomId();
  return `promotions/${safeIndex}-${suffix}.${extension}`;
}

export function extractPromotionSlideStoragePath(url: string) {
  const safeUrl = sanitizeHttpUrl(url);
  if (!safeUrl) {
    return null;
  }

  try {
    const parsed = new URL(safeUrl);
    const marker = "/storage/v1/object/public/";
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) {
      return null;
    }
    const remainder = parsed.pathname.slice(index + marker.length);
    const slashIndex = remainder.indexOf("/");
    if (slashIndex < 0) {
      return null;
    }
    const bucket = remainder.slice(0, slashIndex);
    const path = remainder.slice(slashIndex + 1);
    if (!bucket || !path) {
      return null;
    }
    return {
      bucket,
      path: decodeURIComponent(path),
    };
  } catch {
    return null;
  }
}

function cryptoRandomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
