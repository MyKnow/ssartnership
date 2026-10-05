import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home starts the partner directory before the promotion slide lookup and streams both", async () => {
  const [page, content, carousel] = await Promise.all([
    readFile(
      new URL("../src/app/(site)/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/HomeContent.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/promotions/HomePromotionCarousel.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  const directoryStart = page.indexOf(
    "const directoryPromise = loadHomePartnerDirectoryState",
  );
  const promotionStart = page.indexOf(
    "const promotionSlidesPromise = getHomePromotionSlides",
  );

  assert.ok(directoryStart >= 0);
  assert.ok(promotionStart > directoryStart);
  assert.doesNotMatch(page, /await getHomePromotionSlides/);
  assert.match(page, /directoryPromise=\{directoryPromise\}/);
  assert.match(content, /directoryPromise \?\?/);
  assert.match(
    page,
    /<Suspense\s+fallback=\{\s*<HomePromotionCarouselFallback[\s\S]*?<HomePromotionCarousel\s+slidesPromise=\{promotionSlidesPromise\}/,
  );
  assert.match(carousel, /const slides = await slidesPromise;/);
  assert.match(carousel, /headingLevel="h1"/);
  assert.match(carousel, /aspect-\[21\/9\]/);
});

test("home carousel visibility caches the showcase schedule instead of reading it per render", async () => {
  const source = await readFile(
    new URL("../src/lib/promotions/events.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const getCachedShowcaseEventForHome = unstable_cache\(\s*async \(\) => projectShowcaseRepository\.getEvent\(\),\s*\["promotions", "home-showcase-event"\],\s*\{ revalidate: SLOW_CHANGING_DATA_CACHE_SECONDS \},?\s*\)/,
  );
  assert.match(
    source,
    /canUseSupabase\(\)\s*\?\s*await getCachedShowcaseEventForHome\(\)\s*:\s*await projectShowcaseRepository\.getEvent\(\)/,
  );
});
