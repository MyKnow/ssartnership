import { expect, test } from "@playwright/test";

const viewports = [
  { key: "mobile-360", width: 360, height: 844 },
  { key: "tablet-820", width: 820, height: 1180 },
  { key: "desktop-1366", width: 1366, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`promotion carousel ${viewport.key}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(
      "/iframe.html?id=domains-promotions-promotioncarousel--default&viewMode=story",
      { waitUntil: "domcontentloaded" },
    );
    await page.locator("#storybook-root").waitFor({ state: "visible" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-delay: 0s !important;
          animation-duration: 0s !important;
          caret-color: transparent !important;
          transition-delay: 0s !important;
          transition-duration: 0s !important;
        }
      `,
    });

    const metrics = await page.evaluate(() => {
      const media = document.querySelector<HTMLElement>(
        "[data-promotion-carousel-media]",
      );
      if (!media) {
        throw new Error("광고 캐러셀 미디어 영역을 찾을 수 없습니다.");
      }
      const rect = media.getBoundingClientRect();
      const style = getComputedStyle(media);
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        borderRadius: style.borderRadius,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
    expect(metrics.left).toBeCloseTo(0, 1);
    expect(metrics.right).toBeCloseTo(metrics.clientWidth, 1);
    expect(metrics.width).toBeCloseTo(metrics.clientWidth, 1);
    expect(metrics.height / metrics.width).toBeCloseTo(9 / 21, 3);
    expect(metrics.borderRadius).toBe("0px");

    await expect(page).toHaveScreenshot(
      `promotion-carousel-${viewport.key}.png`,
      {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.015,
        scale: "css",
      },
    );
  });
}
