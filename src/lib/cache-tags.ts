/**
 * `unstable_cache` tags shared by readers and invalidators. The string values
 * are part of the cache contract: changing one orphans every cached entry and
 * every `revalidateTag` call that still uses the old value.
 */

/** Public partner catalog rows (directory, detail, campus, SEO). */
export const PARTNERS_CACHE_TAG = "partners";

/** Public partner categories. */
export const CATEGORIES_CACHE_TAG = "categories";

/** SSAFY cycle anchor and manual override settings. */
export const SSAFY_CYCLE_SETTINGS_CACHE_TAG = "ssafy-cycle-settings";
