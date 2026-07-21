import { expect, test } from "@playwright/test";

const storyId = "screens-public-partnerdetailview--default";

const viewports = [
  { key: "mobile-320", width: 320, height: 720 },
  { key: "mobile-390", width: 390, height: 844 },
  { key: "tablet-820", width: 820, height: 1180 },
  { key: "desktop-1366", width: 1366, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`partner detail keeps period and actions dense at ${viewport.key}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/iframe.html?id=${storyId}&viewMode=story`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator("#storybook-root").waitFor({ state: "visible" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);

    const period = page.locator('[aria-label^="이용 기간"]');
    await expect(period).toHaveCSS("height", "32px");
    await expect(period).toHaveScreenshot(`partner-detail-period-${viewport.key}.png`, {
      animations: "disabled",
      caret: "hide",
      scale: "css",
    });

    if (viewport.width < 640) {
      const actionBar = page.locator("[data-partner-detail-mobile-action-bar]");
      const actionButtons = page.locator("[data-partner-detail-mobile-action-buttons] > *");
      await expect(actionButtons).toHaveCount(2);
      await expect(actionButtons.nth(0)).toHaveCSS("height", "48px");
      await expect(actionButtons.nth(1)).toHaveCSS("height", "48px");
      await expect(actionBar).toHaveScreenshot(
        `partner-detail-action-bar-${viewport.key}.png`,
        {
          animations: "disabled",
          caret: "hide",
          scale: "css",
        },
      );
    }
  });
}
