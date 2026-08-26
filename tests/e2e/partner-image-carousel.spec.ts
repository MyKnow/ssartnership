import { expect, test } from "@playwright/test";

const partnerPath =
  "/partners/cafe-ssafy-001?returnTo=%2F%3Fview%3Dlist%23benefits";

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
