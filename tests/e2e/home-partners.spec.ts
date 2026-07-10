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

    const publicPartnerLink = page.locator('a[href^="/partners/health-001"]').first();
    await expect(publicPartnerLink).toBeVisible();
    await publicPartnerLink.scrollIntoViewIfNeeded();
    await publicPartnerLink.click();

    await expect(page).toHaveURL(/\/partners\/health-001(?:\?|$)/);
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
    await expect(page).toHaveURL(/q=%EB%B0%94%EB%94%94%EB%9D%BC%EC%9D%B8/);

    await typeSearch(page, "");
    await expect(cards).toHaveCount(initialCount);

    await typeSearch(page, "xyznonexistentpartner123456789");
    await expect(cards).toHaveCount(0);

    await typeSearch(page, "");
    await expect(cards).toHaveCount(initialCount);
  });

  test("moves from the featured event into search and returns with filters intact", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "혜택 찾기" }).first().click();
    await expect(page.locator("#benefits")).toBeVisible();
    await typeSearch(page, "바디라인");
    await expect(page).toHaveURL(/q=%EB%B0%94%EB%94%94%EB%9D%BC%EC%9D%B8/);

    const resultCard = page.getByTestId("partner-card").first();
    await expect(resultCard).toBeVisible();
    await resultCard.getByRole("link", { name: "제휴 상세 보기" }).click();

    await expect(page).toHaveURL(/returnTo=/);
    await page.getByRole("link", { name: "혜택 목록으로" }).click();

    await expect(page).toHaveURL(/q=%EB%B0%94%EB%94%94%EB%9D%BC%EC%9D%B8/);
    await expect(page.getByTestId("partner-search-input")).toHaveValue("바디라인");
  });
});
