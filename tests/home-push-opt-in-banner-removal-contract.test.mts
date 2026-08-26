import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("홈은 알림 설정 배너 없이 캐러셀 다음에 혜택 디렉터리를 표시한다", async () => {
  const [homePageSource, skeletonSource] = await Promise.all([
    readFile(new URL("../src/app/(site)/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/components/loading/SitePageSkeletons.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(homePageSource, /HomePushOptInBannerGate/);
  assert.match(
    homePageSource,
    /<PromotionCarousel[\s\S]*?\/>\s*<Container[\s\S]*?<Suspense fallback=\{<HomePartnerExploreSkeleton \/>\}>/,
  );
  assert.match(
    skeletonSource,
    /<HeroSkeleton \/>\s*<Container[\s\S]*?<section className="mt-7 space-y-4">\s*<HomeDirectorySectionHeaderSkeleton \/>\s*<HomeFilterBarSkeleton \/>/,
  );

  await Promise.all([
    assert.rejects(
      access(new URL("../src/components/HomePushOptInBannerGate.tsx", import.meta.url)),
    ),
    assert.rejects(
      access(new URL("../src/components/PushOptInBanner.tsx", import.meta.url)),
    ),
  ]);
});
