import { devices, expect, test } from "@playwright/test";

const iphone = devices["iPhone 13"];
test.use({
  viewport: iphone.viewport,
  userAgent: iphone.userAgent,
  isMobile: true,
  hasTouch: true,
});

test("guest can return to and focus search from the fixed mobile header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("partner-filter-interaction-root")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
  const shortcut = page.getByRole("banner").getByRole("link", { name: "혜택 검색" });
  await expect(shortcut).toBeVisible();
  await shortcut.click();
  const input = page.getByTestId("partner-search-input");
  await expect(input).toBeFocused();
  await expect(input).toBeInViewport();
  await expect(page.locator("[data-pwa-visit-recommendation]")).toBeHidden();
  await input.fill("바디라인");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page.getByTestId("partner-card")).toHaveCount(1);
});

test("all iOS guide images recover from optimizer failures", async ({ page }) => {
  // Deliberate image transport failures exercise recovery, not a test retry.
  await page.route("**/_next/image?**", route => route.abort());
  await page.goto("/install?platform=ios");
  const images = page.getByRole("list", { name: "iPhone·iPad 앱 설치 순서" }).getByRole("img");
  await expect(images).toHaveCount(5);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    expect(await image.evaluate((element: HTMLImageElement) => new URL(element.currentSrc).pathname)).toMatch(/^\/install-guides\//);
  }
});

test("recommendation follows the visible viewport and remains usable at short heights", async ({ page }) => {
  await page.goto("/");
  const recommendation = page.locator("[data-pwa-visit-recommendation]");
  await expect(recommendation).toBeVisible();
  await page.setViewportSize({ width: 390, height: 400 });
  await page.evaluate(() => {
    const viewport = window.visualViewport!;
    Object.defineProperty(viewport, "height", { configurable: true, get: () => window.innerHeight - 100 });
    Object.defineProperty(viewport, "offsetTop", { configurable: true, get: () => 20 });
    viewport.dispatchEvent(new Event("resize"));
  });
  await expect.poll(() => recommendation.evaluate(element => parseFloat(getComputedStyle(element).bottom))).toBe(96);
  const insetBanner = await recommendation.boundingBox();
  const insetHeader = await page.getByRole("banner").boundingBox();
  expect(insetBanner!.y).toBeGreaterThanOrEqual(insetHeader!.y + insetHeader!.height + 12);
  await page.evaluate(() => {
    Reflect.deleteProperty(window.visualViewport!, "height");
    Reflect.deleteProperty(window.visualViewport!, "offsetTop");
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await page.setViewportSize({ width: 390, height: 300 });
  const header = await page.getByRole("banner").boundingBox();
  const banner = await recommendation.boundingBox();
  expect(banner!.y).toBeGreaterThanOrEqual(header!.y + header!.height + 12);
  await recommendation.getByRole("button", { name: "나중에" }).click();
  await expect(recommendation).toHaveCount(0);
});

test("one unavailable guide image can be retried without losing other steps", async ({ page }) => {
  const failedImage = "ios-safari-add-confirmation.png";
  await page.route("**/_next/image?**", route => route.request().url().includes(failedImage) ? route.abort() : route.continue());
  await page.route(`**/install-guides/${failedImage}*`, route => route.abort());
  await page.goto("/install?platform=ios");
  const step = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "이름을 확인하고 추가를 누르세요" }) });
  await step.scrollIntoViewIfNeeded();
  await expect(step.getByRole("button", { name: "이미지 다시 불러오기" })).toBeVisible();
  await expect(step.getByRole("heading")).toBeVisible();
  await page.unroute(`**/install-guides/${failedImage}*`);
  await step.getByRole("button", { name: "이미지 다시 불러오기" }).click();
  await expect.poll(() => step.getByRole("img").evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  await expect(step.getByRole("button", { name: "이미지 다시 불러오기" })).toHaveCount(0);
});
