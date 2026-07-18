import { sanitizeHttpUrl } from "@/lib/validation";

export const PROMOTION_SLIDES_BUCKET = "promotion-slides";

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
