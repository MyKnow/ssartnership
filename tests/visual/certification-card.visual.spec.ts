import { expect, test } from "@playwright/test";

const viewports = [
  { key: "mobile-320", width: 320, height: 844 },
  { key: "mobile-360", width: 360, height: 844 },
  { key: "mobile-390", width: 390, height: 844 },
  { key: "tablet-820", width: 820, height: 1180 },
  { key: "tablet-1024", width: 1024, height: 1180 },
  { key: "desktop-1366", width: 1366, height: 900 },
  { key: "desktop-1440", width: 1440, height: 900 },
  { key: "desktop-1536", width: 1536, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`certification card ${viewport.key}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(
      "/iframe.html?id=screens-member-certificationview--default&viewMode=story",
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
      const avatar = document.querySelector<HTMLElement>(
        "[data-certification-card-avatar]",
      );
      const footer = document.querySelector<HTMLElement>(
        "[data-certification-card-footer]",
      );

      if (!card || !avatar || !footer) {
        throw new Error("인증 카드 레이아웃 요소를 찾을 수 없습니다.");
      }

      const cardRect = card.getBoundingClientRect();
      const avatarRect = avatar.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const cardStyle = getComputedStyle(card);

      return {
        cardRatio: cardRect.width / cardRect.height,
        avatarRatio: avatarRect.width / cardRect.width,
        cardBottom: cardRect.bottom,
        avatarBottom: avatarRect.bottom,
        footerBottom: footerRect.bottom,
        footerTop: footerRect.top,
        footerClientHeight: footer.clientHeight,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        cardClassName: card.className,
        cardTransform: cardStyle.transform,
      };
    });

    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
    expect(metrics.cardRatio).toBeCloseTo(16 / 9, 3);
    expect(metrics.avatarRatio).toBeLessThan(
      viewport.width < 500 ? 0.32 : 0.32,
    );
    expect(metrics.cardClassName).toContain(
      "rounded-[clamp(1rem,3cqw,3rem)]",
    );
    expect(metrics.cardTransform).toBe("none");
    expect(metrics.footerTop).toBeGreaterThanOrEqual(metrics.avatarBottom - 1);
    expect(metrics.footerBottom).toBeLessThanOrEqual(metrics.cardBottom + 1);

    await expect(page).toHaveScreenshot(
      `certification-card-${viewport.key}.png`,
      {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.015,
        scale: "css",
      },
    );
  });
}
