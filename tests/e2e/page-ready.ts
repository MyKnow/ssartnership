import { expect, type Locator, type Page } from "@playwright/test";

export async function waitForPageReady(page: Page, readyLocator: Locator) {
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
  await expect(readyLocator).toBeVisible();
}
