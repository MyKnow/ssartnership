import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourcePaths = [
  "../src/components/partner-card-view/PartnerCardMedia.tsx",
  "../src/components/PartnerImageCarousel.tsx",
  "../src/components/partner-image-carousel/TabletImageCarousel.tsx",
  "../src/components/partner-image-carousel/ThumbStrip.tsx",
  "../src/components/partner-reviews/PartnerReviewCard.tsx",
  "../src/components/partner-reviews/PartnerReviewLightbox.tsx",
  "../src/components/project-showcase/ShowcaseProjectCard.tsx",
  "../src/app/(site)/events/project-showcase/projects/[projectId]/page.tsx",
  "../src/app/(site)/events/project-showcase/my/projects/[projectId]/page.tsx",
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

  const reviewCard = await readFile(
    new URL("../src/components/partner-reviews/PartnerReviewCard.tsx", import.meta.url),
    "utf8",
  );
  const reviewLightbox = await readFile(
    new URL("../src/components/partner-reviews/PartnerReviewLightbox.tsx", import.meta.url),
    "utf8",
  );

  assert.match(reviewCard, /getCachedImageUrl\(image\)/);
  assert.match(
    reviewLightbox,
    /const activeImage = getCachedImageUrl\(/,
  );
});

test("쇼케이스 대표 이미지는 프록시 URL과 레이아웃 폭 sizes로 Next 이미지 최적화를 쓴다", async () => {
  const [card, detail, myDetail, sizes] = await Promise.all(
    [
      "../src/components/project-showcase/ShowcaseProjectCard.tsx",
      "../src/app/(site)/events/project-showcase/projects/[projectId]/page.tsx",
      "../src/app/(site)/events/project-showcase/my/projects/[projectId]/page.tsx",
      "../src/components/project-showcase/image-sizes.ts",
    ].map((sourcePath) => readFile(new URL(sourcePath, import.meta.url), "utf8")),
  );

  for (const source of [card, detail, myDetail]) {
    assert.match(source, /import Image from "next\/image";/);
    assert.match(source, /src=\{getCachedImageUrl\(project\.imageUrl\)\}/);
    assert.match(source, /\bfill\b/);
    assert.doesNotMatch(source, /<img\b/);
    assert.doesNotMatch(source, /no-img-element/);
  }
  assert.match(card, /sizes=\{SHOWCASE_PROJECT_CARD_IMAGE_SIZES\}/);
  assert.doesNotMatch(card, /\bpriority\b/);
  assert.match(detail, /priority\s+sizes=\{SHOWCASE_PROJECT_HERO_IMAGE_SIZES\}/);
  assert.match(myDetail, /sizes=\{SHOWCASE_PROJECT_HERO_IMAGE_SIZES\}/);
  assert.match(
    sizes,
    /SHOWCASE_PROJECT_CARD_IMAGE_SIZES =\s*"\(max-width: 639px\) 100vw, \(max-width: 1023px\) 50vw, 400px"/,
  );
});
