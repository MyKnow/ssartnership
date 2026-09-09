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

test("promotion raw loaders use viewer-independent cache tags", () => {
  assert.match(eventsSource, /PROMOTION_EVENTS_CACHE_TAG/);
  assert.match(eventsSource, /PROMOTION_SLIDES_CACHE_TAG/);
  assert.match(eventsSource, /const getCachedManagedPromotionSlides = unstable_cache/);
  assert.match(eventsSource, /const getCachedManagedEventCampaigns = unstable_cache/);
});

test("promotion mutations invalidate raw cache tags", () => {
  assert.match(
    promotionActionsSource,
    /revalidateTag\(PROMOTION_EVENTS_CACHE_TAG, "max"\)/,
  );
  assert.match(
    promotionActionsSource,
    /revalidateTag\(PROMOTION_SLIDES_CACHE_TAG, "max"\)/,
  );
  assert.match(
    archiveRouteSource,
    /revalidateTag\(PROMOTION_EVENTS_CACHE_TAG, "max"\)/,
  );
  assert.match(
    archiveRouteSource,
    /revalidateTag\(PROMOTION_SLIDES_CACHE_TAG, "max"\)/,
  );
  assert.match(
    archiveRouteSource,
    /rpc\("archive_expired_promotions_batch"/,
  );
  assert.doesNotMatch(
    archiveRouteSource,
    /\.from\("promotion_events"\)\s*\.update\(\{ is_active: false \}\)/,
  );
  assert.doesNotMatch(
    archiveRouteSource,
    /\.from\("promotion_slides"\)\s*\.update\(\{ is_active: false \}\)/,
  );
});
