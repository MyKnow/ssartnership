import { expect, test } from "@playwright/test";
import { waitForPageReady } from "./page-ready";

const partnerPath = "/partners/cafe-ssafy-001";

test("keeps tablet gallery wheel navigation inside the page", async ({ page }) => {
  const invalidImageLayoutWarnings: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "warning" &&
      message.text().includes('has "fill" and a height value of 0')
    ) {
      invalidImageLayoutWarnings.push(message.text());
    }
  });

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(partnerPath);

  const carousel = page.locator(
    "[data-partner-image-carousel=main] [data-partner-image-tablet-carousel]",
  );
  await waitForPageReady(page, carousel);
  await carousel.scrollIntoViewIfNeeded();

  const activeImage = carousel.locator("[data-partner-image-carousel-active]");
  const gallerySurface = carousel.locator("div.relative.isolate");
  const [activeBox, surfaceBox] = await Promise.all([
    activeImage.boundingBox(),
    gallerySurface.boundingBox(),
  ]);
  expect(activeBox).not.toBeNull();
  expect(surfaceBox).not.toBeNull();
  if (!activeBox || !surfaceBox) {
    return;
  }

  expect(activeBox.width / surfaceBox.width).toBeCloseTo(0.65, 2);
  await expect(
    carousel.getByRole("button", { name: "이전 이미지", exact: true }),
  ).toHaveCount(0);
  await expect(
    carousel.getByRole("button", { name: "다음 이미지", exact: true }),
  ).toBeVisible();

  await carousel.hover();
  await page.mouse.wheel(100, 0);
  await expect(
    carousel.getByRole("button", { name: "이미지 2 크게 보기", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(
    "/partners/cafe-ssafy-001",
  );

  const visibleNextPreview = carousel.locator(
    '[data-partner-image-carousel-preview="next"] + button[aria-label$="이미지 3 선택"]',
  );
  const previewBox = await visibleNextPreview.boundingBox();
  expect(previewBox).not.toBeNull();
  if (!previewBox) {
    return;
  }

  await page.mouse.click(previewBox.x + 2, previewBox.y + previewBox.height / 2);
  await expect(
    carousel.getByRole("button", { name: "이미지 3 크게 보기", exact: true }),
  ).toBeVisible();
  expect(invalidImageLayoutWarnings).toEqual([]);
});

test("preserves the document scroll position while changing gallery images", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(partnerPath);

  const carousel = page.locator(
    "[data-partner-image-carousel=main] [data-partner-image-tablet-carousel]",
  );
  await waitForPageReady(page, carousel);
  await carousel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const assertScrollPositionIsPreserved = async (
    action: () => Promise<void>,
  ) => {
    const beforeScrollY = await page.evaluate(() => window.scrollY);
    await action();
    await page.waitForTimeout(500);
    const afterScrollY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(afterScrollY - beforeScrollY)).toBeLessThanOrEqual(1);
  };

  await assertScrollPositionIsPreserved(async () => {
    await carousel.getByRole("button", { name: "다음 이미지", exact: true }).click();
    await expect(
      carousel.getByRole("button", { name: "이미지 2 크게 보기", exact: true }),
    ).toBeVisible();
  });

  await assertScrollPositionIsPreserved(async () => {
    await carousel
      .locator(
        '[data-partner-image-carousel-preview="next"] + button[aria-label$="이미지 3 선택"]',
      )
      .click();
    await expect(
      carousel.getByRole("button", { name: "이미지 3 크게 보기", exact: true }),
    ).toBeVisible();
  });
});

test("moves exactly one image per mobile swipe without pulling the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto(partnerPath);

  const gallery = page.locator("[data-partner-detail-gallery]");
  const mainFrame = gallery.locator("[data-partner-image-main-frame]");
  await waitForPageReady(page, mainFrame);
  await gallery.evaluate((element) => {
    const galleryTop = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, galleryTop - 650));
  });
  await page.waitForTimeout(400);

  const beforeScrollY = await page.evaluate(() => window.scrollY);
  const indicators = gallery.locator("[data-carousel-slide-indicators] button");
  await mainFrame.dispatchEvent("pointerdown", { clientX: 348 });
  await mainFrame.dispatchEvent("pointerup", { clientX: 12 });
  await expect(indicators.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(indicators.nth(2)).toHaveAttribute("aria-pressed", "false");

  // A duplicate pointer-up without a new pointer-down is not a new gesture.
  await mainFrame.dispatchEvent("pointerup", { clientX: 12 });
  await expect(indicators.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(indicators.nth(2)).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(500);

  const afterScrollY = await page.evaluate(() => window.scrollY);
  expect(Math.abs(afterScrollY - beforeScrollY)).toBeLessThanOrEqual(1);
});

test("uses the full-bleed gallery lead only below the mobile breakpoint", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto(partnerPath);

  const gallery = page.locator("[data-partner-detail-gallery]");
  const hero = page.locator("[data-partner-detail-hero-info]");
  await waitForPageReady(page, hero);
  const mainFrame = gallery.locator("[data-partner-image-main-frame]");
  const thumbnailRail = gallery.locator("[data-partner-image-thumbnail-rail]");
  const indicators = gallery.locator("[data-carousel-slide-indicators]");
  const responsiveCarousel = gallery.locator(
    "[data-partner-image-tablet-carousel]",
  );
  const [mobileGalleryBox, mobileHeroBox] = await Promise.all([
    gallery.boundingBox(),
    hero.boundingBox(),
  ]);

  expect(mobileGalleryBox).not.toBeNull();
  expect(mobileHeroBox).not.toBeNull();
  expect(mobileGalleryBox!.y).toBeLessThan(mobileHeroBox!.y);
  expect(mobileHeroBox!.y).toBeCloseTo(
    mobileGalleryBox!.y + mobileGalleryBox!.height,
    0,
  );
  expect(mobileGalleryBox!.y).toBeCloseTo(
    await page
      .locator("main")
      .evaluate((element) => element.getBoundingClientRect().y),
    0,
  );
  await expect(mainFrame).toHaveCSS("border-radius", "0px");
  await expect(hero).toHaveCSS("border-top-width", "0px");
  await expect(hero).toHaveCSS("border-top-left-radius", "0px");
  await expect(hero).toHaveCSS("border-top-right-radius", "0px");
  await expect(hero).toHaveCSS("border-bottom-left-radius", "24px");
  await expect(hero).toHaveCSS("border-bottom-right-radius", "24px");
  await expect(thumbnailRail).toBeHidden();
  await expect(indicators).toBeVisible();
  await expect(responsiveCarousel).toHaveAttribute(
    "data-partner-image-carousel-expanded",
    "false",
  );
  await expect(
    gallery.locator("[data-partner-image-carousel-preview]"),
  ).toHaveCount(0);

  await indicators.locator("button").nth(1).click();
  await expect(indicators.locator("button").nth(1)).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.setViewportSize({ width: 723, height: 884 });
  await page.evaluate(() => window.scrollTo(0, 0));

  const expandedCarousel = gallery.locator(
    "[data-partner-image-tablet-carousel]",
  );
  const [tabletGalleryBox, tabletHeroBox] = await Promise.all([
    gallery.boundingBox(),
    hero.boundingBox(),
  ]);
  expect(tabletGalleryBox).not.toBeNull();
  expect(tabletHeroBox).not.toBeNull();
  expect(tabletHeroBox!.y).toBeLessThan(tabletGalleryBox!.y);
  expect(tabletGalleryBox!.y - (tabletHeroBox!.y + tabletHeroBox!.height)).toBeCloseTo(
    24,
    0,
  );
  await expect(hero).toHaveCSS("border-top-width", "1px");
  await expect(expandedCarousel).toBeVisible();
  await expect(expandedCarousel).toHaveAttribute(
    "data-partner-image-carousel-expanded",
    "true",
  );
  await expect(
    expandedCarousel.locator("[data-partner-image-carousel-preview]"),
  ).not.toHaveCount(0);
  await expect(mainFrame).toBeVisible();
  await expect(gallery.locator("[data-partner-image-main-frame]")).toHaveCount(1);
  await expect(thumbnailRail).toBeHidden();
  await expect(indicators).toBeHidden();
  expect(
    await expandedCarousel
      .locator("[data-partner-image-carousel-active]")
      .evaluate((element) => {
        const surface = element.parentElement;
        return surface
          ? element.getBoundingClientRect().width /
              surface.getBoundingClientRect().width
          : 0;
      }),
  ).toBeCloseTo(0.65, 2);
});
