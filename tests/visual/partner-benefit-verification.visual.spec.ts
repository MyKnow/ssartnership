import { expect, test } from "@playwright/test";

const viewports = [
  { key: "mobile-320", width: 320, height: 844, expectedRatio: 16 / 10 },
  { key: "mobile-390", width: 390, height: 844, expectedRatio: 16 / 10 },
  { key: "mobile-in-app-590", width: 590, height: 960, expectedRatio: 16 / 10 },
  { key: "tablet-820", width: 820, height: 1180, expectedRatio: 16 / 9 },
  { key: "desktop-1366", width: 1366, height: 900, expectedRatio: 16 / 9 },
] as const;

for (const viewport of viewports) {
  test(`partner benefit verification card ${viewport.key}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(
      "/iframe.html?id=screens-public-partnerbenefitverificationview--default&viewMode=story",
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
      const card = document.querySelector<HTMLElement>(
        "[data-testid=certification-card-frame]",
      );
      const footer = document.querySelector<HTMLElement>(
        "[data-certification-card-footer]",
      );
      const timestampRow = document.querySelector<HTMLElement>(
        "[data-certification-card-timestamp-row]",
      );

      if (!card || !footer || !timestampRow) {
        throw new Error("혜택 이용 인증 카드 레이아웃 요소를 찾을 수 없습니다.");
      }

      const cardRect = card.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const timestampRowRect = timestampRow.getBoundingClientRect();

      return {
        cardRatio: cardRect.width / cardRect.height,
        cardTop: cardRect.top,
        cardBottom: cardRect.bottom,
        footerTop: footerRect.top,
        footerBottom: footerRect.bottom,
        timestampRowBottom: timestampRowRect.bottom,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
    expect(metrics.cardRatio).toBeCloseTo(viewport.expectedRatio, 2);
    expect(metrics.footerTop).toBeGreaterThanOrEqual(metrics.cardTop - 1);
    expect(metrics.footerBottom).toBeLessThanOrEqual(metrics.cardBottom + 1);
    expect(metrics.timestampRowBottom).toBeLessThanOrEqual(metrics.cardBottom + 1);

    await expect(page).toHaveScreenshot(
      `partner-benefit-verification-card-${viewport.key}.png`,
      {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.015,
        scale: "css",
      },
    );
  });
}
