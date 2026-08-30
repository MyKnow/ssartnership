import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("공개 제휴처 상세는 대표 이미지를 반복하지 않고 갤러리만 렌더링한다", () => {
  const page = readRepoFile("src/app/(site)/partners/[id]/page.tsx");
  const lead = readRepoFile(
    "src/app/(site)/partners/[id]/_page/PartnerDetailLeadSection.tsx",
  );

  assert.doesNotMatch(page, /variant="hero"/);
  assert.doesNotMatch(
    page,
    /images=\{partner\.thumbnail \? \[partner\.thumbnail\] : \[\]\}/,
  );
  assert.match(page, /<PartnerDetailLeadSection/);
  assert.match(page, /images=\{partner\.images\}/);
  assert.match(lead, /data-partner-detail-gallery/);
  assert.match(lead, /images=\{galleryImages\}/);
  assert.match(lead, /variant="main"/);
});

test("대표 이미지는 공유 메타데이터에 유지하고 모든 원본 이미지는 갤러리에 남긴다", () => {
  const page = readRepoFile("src/app/(site)/partners/[id]/page.tsx");
  const repository = readRepoFile(
    "src/lib/repositories/supabase/partner-repository.supabase.ts",
  );

  assert.match(page, /url: partner\.thumbnail \?\? "\/icon-512\.png"/);
  assert.match(page, /images: \[partner\.thumbnail \?\? "\/icon-512\.png"\]/);
  assert.match(repository, /const galleryImages = row\.images \?\? \[\];/);
  assert.match(
    repository,
    /const thumbnail = row\.thumbnail \?\? row\.images\?\.\[0\] \?\? null;/,
  );
  assert.doesNotMatch(repository, /\(row\.images \?\? \[\]\)\.slice\(1\)/);
});

test("모바일 제휴처 상세만 shell 여백 없이 전체 폭을 사용한다", () => {
  const page = readRepoFile("src/app/(site)/partners/[id]/page.tsx");
  const container = readRepoFile("src/components/ui/Container.tsx");

  assert.match(
    page,
    /partner\.images\?\.length[\s\S]*"pb-28 pt-0 sm:pt-10 md:pb-16"[\s\S]*"pb-28 pt-4 sm:pt-10 md:pb-16"/,
  );
  assert.match(
    container,
    /max-w-none sm:max-w-\[min\(var\(--grid-max\),calc\(100vw-1\.5rem\)\)\]/,
  );
  assert.match(container, /px-0 sm:px-6 lg:px-8/);
});

test("모바일 갤러리는 정보 카드보다 먼저 오고 태블릿부터 기존 순서를 복원한다", () => {
  const lead = readRepoFile(
    "src/app/(site)/partners/[id]/_page/PartnerDetailLeadSection.tsx",
  );
  const carousel = readRepoFile("src/components/PartnerImageCarousel.tsx");
  const tabletCarousel = readRepoFile(
    "src/components/partner-image-carousel/TabletImageCarousel.tsx",
  );
  const promotionCarousel = readRepoFile(
    "src/components/promotions/PromotionCarousel.tsx",
  );

  assert.match(
    lead,
    /data-partner-detail-lead[\s\S]*flex flex-col gap-0 sm:flex-col-reverse sm:gap-6/,
  );
  assert.match(
    lead,
    /data-partner-detail-gallery[\s\S]*data-partner-detail-hero-info/,
  );
  assert.match(lead, /mobileFullBleed/);
  assert.match(lead, /hideThumbnailsOnMobile/);
  assert.match(lead, /tabletCarouselFrom="sm"/);
  assert.match(
    lead,
    /hasGallery[\s\S]*rounded-t-none rounded-b-\[var\(--radius-card\)\] border-t-0[\s\S]*rounded-\[var\(--radius-card\)\]/,
  );
  assert.match(lead, /border border-border/);
  assert.match(carousel, /rounded-none sm:rounded-3xl/);
  assert.match(carousel, /const shouldRenderThumbStrip =/);
  assert.match(
    carousel,
    /showTabletCarousel &&[\s\S]*tabletCarouselFrom === "sm" &&[\s\S]*hideThumbnailsOnMobile/,
  );
  assert.match(carousel, /tabletCarouselFrom = "md"/);
  assert.match(carousel, /visibleFrom=\{tabletCarouselFrom\}/);
  assert.match(carousel, /!showTabletCarousel \? \(/);
  assert.doesNotMatch(carousel, /showTabletCarousel[\s\S]*sm:invisible/);
  assert.doesNotMatch(carousel, /showTabletCarousel[\s\S]*md:invisible/);
  assert.match(carousel, /CarouselSlideIndicators/);
  assert.match(tabletCarousel, /visibleFrom=\{visibleFrom\}/);
  assert.match(
    tabletCarousel,
    /visibleFrom === "sm"[\s\S]*\(min-width: 640px\) 46vw[\s\S]*\(min-width: 768px\) 46vw/,
  );
  assert.match(tabletCarousel, /const \[isExpandedCarousel, setIsExpandedCarousel\]/);
  assert.match(tabletCarousel, /window\.matchMedia/);
  assert.match(
    tabletCarousel,
    /\{isExpandedCarousel[\s\S]*previousPreviews\.map[\s\S]*nextPreviews\.map/,
  );
  assert.match(promotionCarousel, /CarouselSlideIndicators/);
});

test("반응형 제휴처 갤러리는 현재 이미지를 한 번만 렌더링한다", () => {
  const carousel = readRepoFile("src/components/PartnerImageCarousel.tsx");
  const responsiveCarousel = readRepoFile(
    "src/components/partner-image-carousel/TabletImageCarousel.tsx",
  );

  assert.match(
    carousel,
    /\{showTabletCarousel \? \([\s\S]*<TabletImageCarousel[\s\S]*\) : null\}/,
  );
  assert.match(carousel, /\{!showTabletCarousel \? \([\s\S]*data-partner-image-carousel-stage/);
  assert.match(responsiveCarousel, /data-partner-image-main-frame/);
  assert.match(responsiveCarousel, /data-partner-image-carousel-active/);
  assert.match(
    responsiveCarousel,
    /data-partner-image-carousel-expanded=\{isExpandedCarousel\}/,
  );
  assert.match(
    responsiveCarousel,
    /\(max-width: 639px\) 100vw, 65vw[\s\S]*\(max-width: 767px\) 100vw, 65vw/,
  );
});

test("제휴처 갤러리는 현재 이미지의 다음 한 장만 미리 불러온다", () => {
  const controller = readRepoFile(
    "src/components/partner-image-carousel/useCarouselController.ts",
  );

  assert.match(controller, /warmCachedImageUrl\(cachedImages\[activeIndex \+ 1\]\)/);
  assert.match(controller, /\[activeIndex, cachedImages, hasImages\]/);
  assert.doesNotMatch(controller, /warmCachedImageUrls/);
  assert.doesNotMatch(controller, /cachedImages\.slice\(1\)/);
});
