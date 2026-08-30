import { expect, type Locator, type Page } from "@playwright/test";

export async function waitForPageReady(page: Page, readyLocator: Locator) {
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
  await expect(readyLocator).toBeVisible();
}

export async function waitForScrollStability(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let lastX = window.scrollX;
      let lastY = window.scrollY;
      let stableFrames = 0;

      const tick = () => {
        const nextX = window.scrollX;
        const nextY = window.scrollY;
        const isStable =
          Math.abs(nextX - lastX) <= 1 && Math.abs(nextY - lastY) <= 1;

        stableFrames = isStable ? stableFrames + 1 : 0;
        lastX = nextX;
        lastY = nextY;

        if (stableFrames >= 2) {
          resolve();
          return;
        }

        window.requestAnimationFrame(tick);
      };

      window.requestAnimationFrame(tick);
    });
  });
}
