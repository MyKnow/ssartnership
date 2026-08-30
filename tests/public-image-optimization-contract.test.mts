import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourcePaths = [
  "../src/components/partner-card-view/PartnerCardMedia.tsx",
  "../src/components/PartnerImageCarousel.tsx",
  "../src/components/partner-image-carousel/TabletImageCarousel.tsx",
  "../src/components/partner-image-carousel/ThumbStrip.tsx",
] as const;

test("공개 제휴 이미지는 화면 크기별 Next 이미지 최적화를 사용한다", async () => {
  const [nextConfig, promotionCarousel, ...partnerImageSources] =
    await Promise.all([
      readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../src/components/promotions/PromotionCarousel.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      ...sourcePaths.map((sourcePath) =>
        readFile(new URL(sourcePath, import.meta.url), "utf8"),
      ),
    ]);

  assert.match(nextConfig, /localPatterns:[\s\S]*pathname: "\/api\/image"/);
  assert.match(promotionCarousel, /getCachedImageUrl\(slide\.imageSrc\)/);
  assert.doesNotMatch(promotionCarousel, /unoptimized/);
  assert.doesNotMatch(promotionCarousel, /isRemoteImageSrc/);

  for (const source of partnerImageSources) {
    assert.doesNotMatch(source, /unoptimized/);
  }
});
