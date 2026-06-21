import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function typeSearch(page: Page, value: string) {
  const searchInput = page.getByTestId("partner-search-input");
  await searchInput.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(value);
}

test.describe("public partner discovery", () => {
  test("lists partners and opens a public partner detail page", async ({ page }) => {
    await page.goto("/");

    const cards = page.getByTestId("partner-card");
    await expect(cards.first()).toBeVisible();

    const initialCount = await cards.count();
    expect(initialCount).toBeGreaterThan(0);

    await cards.first().locator('a[href^="/partners/"]').first().click();

    await expect(page).toHaveURL(/\/partners\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("filters partners by search keyword and shows an empty state", async ({ page }) => {
    await page.goto("/");

    const cards = page.getByTestId("partner-card");

    await expect(cards.first()).toBeVisible();
    const initialCount = await cards.count();
    expect(initialCount).toBeGreaterThan(0);

    await expect
      .poll(async () => {
        await typeSearch(page, "바디라인");
        return cards.count();
      })
      .toBe(1);

    await typeSearch(page, "");
    await expect(cards).toHaveCount(initialCount);

    await typeSearch(page, "xyznonexistentpartner123456789");
    await expect(cards).toHaveCount(0);

    await typeSearch(page, "");
    await expect(cards).toHaveCount(initialCount);
  });
});
