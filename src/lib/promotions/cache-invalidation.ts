import { revalidatePath, revalidateTag } from "next/cache";
import {
  PROMOTION_EVENTS_CACHE_TAG,
  PROMOTION_SLIDES_CACHE_TAG,
} from "@/lib/promotions/events";

export type PromotionCacheInvalidator = {
  tag: (tag: string) => void;
  path: (path: string, type?: "page" | "layout") => void;
};

const nextCacheInvalidator: PromotionCacheInvalidator = {
  tag: (tag) => revalidateTag(tag, "max"),
  path: (path, type) => (type ? revalidatePath(path, type) : revalidatePath(path)),
};

/**
 * Promotion slides and events feed the home carousel and the admin advertising
 * screens. The raw loaders are cached with viewer-independent tags; the paths
 * only refresh pages that are already rendered.
 */
export function revalidatePromotionSurfaces(
  invalidator: PromotionCacheInvalidator = nextCacheInvalidator,
) {
  invalidator.tag(PROMOTION_EVENTS_CACHE_TAG);
  invalidator.tag(PROMOTION_SLIDES_CACHE_TAG);
  invalidator.path("/");
  invalidator.path("/admin");
  invalidator.path("/admin/advertisement");
  invalidator.path("/admin/promotions");
}

/**
 * Event registrations, draws, and expiry also change every event page. The
 * dynamic route patterns cover each slug, so callers no longer add per-slug
 * literal paths next to the pattern.
 */
export function revalidatePromotionEventSurfaces(
  invalidator: PromotionCacheInvalidator = nextCacheInvalidator,
) {
  revalidatePromotionSurfaces(invalidator);
  invalidator.path("/admin/event");
  invalidator.path("/admin/event/[slug]", "page");
  invalidator.path("/events/[slug]", "page");
}
