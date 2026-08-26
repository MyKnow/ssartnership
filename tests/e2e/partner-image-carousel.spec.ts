import { expect, test } from "@playwright/test";

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
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);

  const carousel = page.locator(
    "[data-partner-image-carousel=main] [data-partner-image-tablet-carousel]",
  );
  await expect(carousel).toBeVisible();
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
    'button[aria-label$="이미지 3 선택"]',
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
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);

  const carousel = page.locator(
    "[data-partner-image-carousel=main] [data-partner-image-tablet-carousel]",
  );
  await expect(carousel).toBeVisible();
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
    await carousel.locator('button[aria-label$="이미지 3 선택"]').click();
    await expect(
      carousel.getByRole("button", { name: "이미지 3 크게 보기", exact: true }),
    ).toBeVisible();
  });
});

test("does not pull the mobile page down to the active thumbnail after a swipe", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto(partnerPath);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);

  const gallery = page.locator("[data-partner-detail-gallery]");
  const mainFrame = gallery.locator("[data-partner-image-main-frame]");
  await expect(mainFrame).toBeVisible();
  await gallery.evaluate((element) => {
    const galleryTop = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, galleryTop - 650));
  });
  await page.waitForTimeout(400);

  const beforeScrollY = await page.evaluate(() => window.scrollY);
  await mainFrame.dispatchEvent("pointerdown", { clientX: 280 });
  await mainFrame.dispatchEvent("pointerup", { clientX: 120 });
  await expect(
    gallery.getByRole("button", { name: "이미지 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(500);

  const afterScrollY = await page.evaluate(() => window.scrollY);
  expect(Math.abs(afterScrollY - beforeScrollY)).toBeLessThanOrEqual(1);
});
