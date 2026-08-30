import { expect, type Locator, type Page } from "@playwright/test";

export async function waitForPageReady(page: Page, readyLocator: Locator) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await expect(readyLocator).toBeVisible();

    try {
      await page.evaluate(async () => {
        if (!document.fonts || document.fonts.status === "loaded") {
          return;
        }

        await document.fonts.ready;
      });
      return;
    } catch (error) {
      if (attempt === 2 || !isExecutionContextDestroyedError(error)) {
        throw error;
      }
    }
  }
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

function isExecutionContextDestroyedError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Execution context was destroyed")
  );
}
