import { expect, test } from "@playwright/test";

test.describe("public partner discovery", () => {
  test("lists partners and opens a public partner detail page", async ({ page }) => {
    await page.goto("/");

    const cards = page.getByTestId("partner-card");
    await expect(cards.first()).toBeVisible();

    const initialCount = await cards.count();
    expect(initialCount).toBeGreaterThan(0);

    await cards.first().getByRole("link", { name: /상세 보기/ }).click();

    await expect(page).toHaveURL(/\/partners\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("filters partners by search keyword and shows an empty state", async ({ page }) => {
    await page.goto("/");

    const searchInput = page.getByTestId("partner-search-input");
    const cards = page.getByTestId("partner-card");

    await expect(cards.first()).toBeVisible();
    const initialCount = await cards.count();
    expect(initialCount).toBeGreaterThan(0);

    await searchInput.fill("xyznonexistentpartner123456789");
    await expect(cards).toHaveCount(0);

    await searchInput.clear();
    await expect(cards).toHaveCount(initialCount);
  });
});
