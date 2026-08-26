import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const carouselSourceUrl = new URL(
  "../src/components/promotions/PromotionCarousel.tsx",
  import.meta.url,
);
const homePageSourceUrl = new URL("../src/app/(site)/page.tsx", import.meta.url);
const skeletonSourceUrl = new URL(
  "../src/components/loading/SitePageSkeletons.tsx",
  import.meta.url,
);
const siteHeaderSourceUrl = new URL(
  "../src/components/SiteHeader.tsx",
  import.meta.url,
);
const globalsSourceUrl = new URL("../src/app/globals.css", import.meta.url);

test("홈 프로모션은 설명 블록 없이 뷰포트 전체 폭의 21:9 직사각형으로 표시된다", async () => {
  const [source, homePageSource, skeletonSource, siteHeaderSource, globalsSource] =
    await Promise.all([
      readFile(carouselSourceUrl, "utf8"),
      readFile(homePageSourceUrl, "utf8"),
      readFile(skeletonSourceUrl, "utf8"),
      readFile(siteHeaderSourceUrl, "utf8"),
      readFile(globalsSourceUrl, "utf8"),
    ]);

  assert.match(source, /<Heading className="sr-only">/);
  assert.match(source, /left-1\/2/);
  assert.match(source, /left-1\/2 mt-0 w-screen/);
  assert.match(source, /w-screen/);
  assert.match(source, /-translate-x-1\/2/);
  assert.match(
    source,
    /data-promotion-carousel-media[\s\S]*aspect-\[21\/9\][\s\S]*w-full/,
  );
  assert.doesNotMatch(source, /className="mb-4 grid/);
  assert.doesNotMatch(source, /rounded-overlay/);
  assert.match(
    homePageSource,
    /<main>\s*<PromotionCarousel[\s\S]*headingLevel="h1"[\s\S]*?\/>\s*<Container className="pb-16 pt-0"/,
  );
  assert.match(homePageSource, /<Container className="pb-16 pt-0"/);
  assert.match(
    skeletonSource,
    /function HeroSkeleton\(\)[\s\S]*aspect-\[21\/9\][\s\S]*w-full/,
  );
  assert.match(
    skeletonSource,
    /<main>\s*<HeroSkeleton \/>\s*<Container className="pb-16 pt-0"/,
  );
  assert.match(siteHeaderSource, /className="safe-site-header-spacer"/);
  assert.match(siteHeaderSource, /style=\{headerHeight \? \{ height: headerHeight \}/);
  assert.match(
    globalsSource,
    /\.safe-site-header-spacer \{\s*height: calc\(4\.3125rem \+ env\(safe-area-inset-top\)\)/,
  );
});
