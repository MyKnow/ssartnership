import { devices, expect, test } from "@playwright/test";

const iphone = devices["iPhone 13"];
test.use({
  viewport: iphone.viewport,
  userAgent: iphone.userAgent,
  isMobile: true,
  hasTouch: true,
});

test("mobile sort labels fit at narrow widths", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("partner-filter-interaction-root")).toHaveAttribute("data-hydrated", "true");
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 360, 390, 820]) {
    await page.setViewportSize({ width, height: 844 });
    const select = page.getByTestId("partner-sort-select-mobile");
    await expect(select).toBeVisible();
    const measurement = await select.evaluate((element: HTMLSelectElement) => {
      const style = getComputedStyle(element);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      return {
        available: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        required: Math.max(...Array.from(element.options, option => context.measureText(option.text).width)),
        height: element.getBoundingClientRect().height,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(measurement.available, `${width}px option text space`).toBeGreaterThanOrEqual(measurement.required);
    expect(measurement.height).toBeGreaterThanOrEqual(44);
    expect(measurement.overflow).toBe(0);
  }
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

test("install recommendation stays at the bottom and clear of the header", async ({ page }) => {
  await page.goto("/");
  const recommendation = page.locator("[data-pwa-visit-recommendation]");
  await expect(recommendation).toBeVisible();
  for (const size of [{ width: 360, height: 780 }, { width: 390, height: 844 }, { width: 820, height: 500 }]) {
    await page.setViewportSize(size);
    const banner = await recommendation.boundingBox();
    const header = await page.getByRole("banner").boundingBox();
    expect(banner!.y).toBeGreaterThan(header!.y + header!.height);
    expect(size.height - (banner!.y + banner!.height)).toBeGreaterThanOrEqual(12);
    expect(size.height - (banner!.y + banner!.height)).toBeLessThan(80);
  }
  await recommendation.getByRole("button", { name: "앱 설치 권장 닫기" }).click();
  await expect(recommendation).toHaveCount(0);
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

test("home and iOS guide preserve content across responsive widths", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByTestId("partner-filter-interaction-root")).toHaveAttribute("data-hydrated", "true");
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 360, 390, 820, 1366]) {
    await page.setViewportSize({ width, height: width >= 820 ? 1000 : 844 });
    await expect(page.getByRole("heading", { name: "제휴 혜택 찾기" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await page.screenshot({ path: `.tmp/ui-qa/issue-463/home-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await page.goto("/install?platform=ios");
  const steps = page.getByRole("list", { name: "iPhone·iPad 앱 설치 순서" });
  for (const image of await steps.getByRole("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => document.fonts.ready);
  for (const width of [360, 820, 1366]) {
    await page.setViewportSize({ width, height: width >= 820 ? 1000 : 844 });
    await page.getByRole("heading", { name: "싸트너십 앱 설치", exact: true }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await page.screenshot({ path: `.tmp/ui-qa/issue-463/install-${width}.png`, fullPage: true, animations: "disabled" });
  }
  expect(errors).toEqual([]);
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
