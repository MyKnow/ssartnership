import { extractPublicStorageObjectPath } from "@/lib/public-storage-url";

export const PROMOTION_SLIDES_BUCKET = "promotion-slides";

export function extractPromotionSlideStoragePath(url: string) {
  return extractPublicStorageObjectPath(url);
}
