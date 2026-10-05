import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const eventsSource = readFileSync(
  new URL("../src/lib/promotions/events.ts", import.meta.url),
  "utf8",
);
const promotionActionsSource = readFileSync(
  new URL("../src/app/admin/(protected)/_actions/promotion-actions.ts", import.meta.url),
  "utf8",
);
const archiveRouteSource = readFileSync(
  new URL("../src/app/api/cron/archive-expired-promotions/route.ts", import.meta.url),
  "utf8",
);
const cacheInvalidationSource = readFileSync(
  new URL("../src/lib/promotions/cache-invalidation.ts", import.meta.url),
  "utf8",
);
type CacheInvalidationModule = typeof import("../src/lib/promotions/cache-invalidation.ts");
type EventsModule = typeof import("../src/lib/promotions/events.ts");
const cacheInvalidationModulePromise = import(
  new URL("../src/lib/promotions/cache-invalidation.ts", import.meta.url).href
) as Promise<CacheInvalidationModule>;
const eventsModulePromise = import(
  new URL("../src/lib/promotions/events.ts", import.meta.url).href
) as Promise<EventsModule>;
const promotionEventsStoreSource = readFileSync(
  new URL("../src/lib/promotions/events-store.server.ts", import.meta.url),
  "utf8",
);

test("promotion raw loaders use viewer-independent cache tags", () => {
  assert.match(eventsSource, /PROMOTION_EVENTS_CACHE_TAG/);
  assert.match(eventsSource, /PROMOTION_SLIDES_CACHE_TAG/);
  assert.match(eventsSource, /const getCachedManagedPromotionSlides = unstable_cache/);
  assert.match(eventsSource, /const getCachedManagedEventCampaigns = unstable_cache/);
});

test("promotion mutations invalidate raw cache tags through the shared helper", async () => {
  const { revalidatePromotionEventSurfaces, revalidatePromotionSurfaces } =
    await cacheInvalidationModulePromise;
  const { PROMOTION_EVENTS_CACHE_TAG, PROMOTION_SLIDES_CACHE_TAG } =
    await eventsModulePromise;

  const slideCalls: string[] = [];
  revalidatePromotionSurfaces({
    tag: (tag) => slideCalls.push(`tag:${tag}`),
    path: (path, type) => slideCalls.push(type ? `${type}:${path}` : path),
  });
  assert.deepEqual(slideCalls, [
    `tag:${PROMOTION_EVENTS_CACHE_TAG}`,
    `tag:${PROMOTION_SLIDES_CACHE_TAG}`,
    "/",
    "/admin",
    "/admin/advertisement",
    "/admin/promotions",
  ]);

  const eventCalls: string[] = [];
  revalidatePromotionEventSurfaces({
    tag: (tag) => eventCalls.push(`tag:${tag}`),
    path: (path, type) => eventCalls.push(type ? `${type}:${path}` : path),
  });
  assert.deepEqual(eventCalls, [
    ...slideCalls,
    "/admin/event",
    "page:/admin/(protected)/event/[slug]",
    "page:/(site)/events/[slug]",
  ]);
  assert.equal(new Set(eventCalls).size, eventCalls.length);

  assert.match(cacheInvalidationSource, /revalidateTag\(tag, "max"\)/);
  assert.match(promotionActionsSource, /revalidatePromotionEventSurfaces\(\);/);
  assert.match(promotionActionsSource, /revalidatePromotionSurfaces\(\);/);
  assert.doesNotMatch(promotionActionsSource, /revalidatePath\(|revalidateTag\(/);
  assert.match(archiveRouteSource, /revalidatePromotionEventSurfaces\(\);/);
  assert.doesNotMatch(archiveRouteSource, /revalidatePath\(`\/events\/\$\{slug\}`\)/);
  assert.match(
    promotionEventsStoreSource,
    /rpc\("archive_expired_promotions_batch"/,
  );
  assert.match(archiveRouteSource, /archiveExpiredPromotionsBatch\(/);
  assert.doesNotMatch(
    archiveRouteSource,
    /\.from\("promotion_events"\)\s*\.update\(\{ is_active: false \}\)/,
  );
  assert.doesNotMatch(
    archiveRouteSource,
    /\.from\("promotion_slides"\)\s*\.update\(\{ is_active: false \}\)/,
  );
});

test("promotion event writes live in the server store, not the admin action", () => {
  assert.doesNotMatch(promotionActionsSource, /\.from\("promotion_events"\)/);
  assert.match(promotionEventsStoreSource, /\.from\("promotion_events"\)\.insert\(payload\)/);
  assert.match(
    promotionEventsStoreSource,
    /\.from\("promotion_events"\)\.update\(payload\)\.eq\("id", target\.id\)/,
  );
  assert.match(promotionEventsStoreSource, /\.from\("promotion_events"\)\.delete\(\)\.eq\("id", id\)/);
  assert.match(promotionActionsSource, /redirectEventRegistrationError\(slug, "admin_event_create_failed", error\)/);
  assert.match(promotionActionsSource, /redirectEventRegistrationError\(slug, "admin_event_update_failed", error\)/);
  assert.match(promotionActionsSource, /redirectEventRegistrationError\(slug, "admin_event_delete_failed", error\)/);
});
