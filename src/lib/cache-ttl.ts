/**
 * Shared `unstable_cache` revalidate windows, in seconds.
 *
 * Freshness after a write is the job of tag invalidation (`cache-tags.ts`).
 * These windows only bound how long an untagged or burst read may be reused,
 * so prefer an existing constant over a new literal.
 */

/**
 * #265: collapses bursts of identical admin read-model renders (prefetch,
 * redirect, refresh) into one query. It is not a freshness window.
 */
export const ADMIN_READ_BURST_CACHE_SECONDS = 3;

/** Rarely changing option and setting data such as SSAFY cycle settings. */
export const SLOW_CHANGING_DATA_CACHE_SECONDS = 60;

/**
 * Round trip for the public catalog cache-version snapshot. Writers bump
 * `public_cache_versions` and the `partners`/`categories` tags together.
 */
export const PUBLIC_CACHE_VERSION_SNAPSHOT_SECONDS = 30;
