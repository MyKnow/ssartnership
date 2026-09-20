import { expect, test } from "@playwright/test";
import { waitForPageReady, waitForScrollStability } from "./page-ready";

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
  await waitForScrollStability(page);

  const assertScrollPositionIsPreserved = async (
    action: () => Promise<void>,
  ) => {
    const beforeScrollY = await page.evaluate(() => window.scrollY);
    await action();
    await waitForScrollStability(page);
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
  await waitForScrollStability(page);

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
  await waitForScrollStability(page);

  const afterScrollY = await page.evaluate(() => window.scrollY);
  expect(Math.abs(afterScrollY - beforeScrollY)).toBeLessThanOrEqual(1);
});
