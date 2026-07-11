import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function typeSearch(page: Page, value: string) {
  await page.waitForLoadState("networkidle");
  const searchInput = page.getByTestId("partner-search-input");
  await searchInput.fill(value);
}

test.describe("public partner discovery", () => {
  test("keeps the mobile list summary compact without a separate detail action", async ({ page }) => {
    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/?view=list#benefits");

      const card = page.getByTestId("partner-card").first();
      const detailAction = card.getByRole("link", { name: "제휴 상세 보기" });
      const titleLink = card.getByRole("link", { name: /상세 보기/ });
      const thumbnail = card.locator("[data-partner-card-media]");
      const categoryControl = card.getByRole("button", { name: /필터 적용$/ });
      const favoriteMetric = card.getByLabel(/즐겨찾기 \d+개/);
      await expect(detailAction).toHaveCount(0);
      await expect(titleLink).toBeVisible();
      await expect(thumbnail).toBeVisible();

      const cardBox = await card.boundingBox();
      const thumbnailBox = await thumbnail.boundingBox();
      const categoryBox = await categoryControl.boundingBox();
      const favoriteBox = await favoriteMetric.boundingBox();
      expect(cardBox).not.toBeNull();
      expect(thumbnailBox).not.toBeNull();
      expect(categoryBox).not.toBeNull();
      expect(favoriteBox).not.toBeNull();

      if (!cardBox || !thumbnailBox || !categoryBox || !favoriteBox) {
        continue;
      }
      expect(Math.abs(categoryBox.y - favoriteBox.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(categoryBox.height - favoriteBox.height)).toBeLessThanOrEqual(1);
      expect(cardBox.height).toBeLessThanOrEqual(144);
    }
  });

  test("adapts the directory from medium grid to expanded two-pane layout", async ({
    page,
  }) => {
    const scenarios = [
      { width: 820, sidebar: false, columns: 2 },
      { width: 839, sidebar: false, columns: 2 },
      { width: 840, sidebar: true, columns: 1 },
      { width: 1024, sidebar: true, columns: 1 },
      { width: 1366, sidebar: true, columns: 2 },
    ] as const;

    for (const scenario of scenarios) {
      await page.setViewportSize({ width: scenario.width, height: 1024 });
      await page.goto("/?view=card#benefits");
      await page.waitForLoadState("networkidle");

      const filterPanel = page.getByTestId("partner-filter-panel");
      const resultsPane = page.getByTestId("partner-results-pane");
      const partnerGrid = page.getByTestId("partner-grid");
      await expect(filterPanel).toBeVisible();
      await expect(resultsPane).toBeVisible();
      await expect(partnerGrid).toBeVisible();

      const filterBox = await filterPanel.boundingBox();
      const resultsBox = await resultsPane.boundingBox();
      expect(filterBox).not.toBeNull();
      expect(resultsBox).not.toBeNull();

      if (!filterBox || !resultsBox) {
        continue;
      }

      if (scenario.sidebar) {
        expect(filterBox.x + filterBox.width).toBeLessThan(resultsBox.x);
      } else {
        expect(filterBox.y + filterBox.height).toBeLessThan(resultsBox.y);
      }

      const gridColumnCount = await partnerGrid.evaluate((element) =>
        window.getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean)
          .length,
      );
      expect(gridColumnCount).toBe(scenario.columns);
    }
  });

  test("prioritizes search on mobile and preserves decision information in desktop lists", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 844 });
    await page.goto("/?view=list#benefits");
    await page.waitForLoadState("networkidle");

    const searchBox = await page.getByTestId("partner-search-input").boundingBox();
    const categoryBox = await page
      .getByRole("group", { name: "제휴처 카테고리" })
      .boundingBox();
    expect(searchBox).not.toBeNull();
    expect(categoryBox).not.toBeNull();
    if (searchBox && categoryBox) {
      expect(searchBox.y).toBeLessThan(categoryBox.y);
    }

    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/?view=list#benefits");
    await page.waitForLoadState("networkidle");

    const tabletCard = page.getByTestId("partner-card").first();
    await expect(tabletCard.getByText("혜택", { exact: true })).toBeHidden();
    await expect(tabletCard.getByText("적용 대상", { exact: true })).toBeHidden();

    const categoryControl = tabletCard.getByRole("button", {
      name: /필터 적용$/,
    });
    const favoriteMetric = tabletCard.getByLabel(/즐겨찾기 \d+개/);
    const categoryControlBox = await categoryControl.boundingBox();
    const favoriteBox = await favoriteMetric.boundingBox();
    expect(categoryControlBox).not.toBeNull();
    expect(favoriteBox).not.toBeNull();
    if (categoryControlBox && favoriteBox) {
      expect(
        Math.abs(categoryControlBox.height - favoriteBox.height),
      ).toBeLessThanOrEqual(1);
      expect(categoryControlBox.height).toBeGreaterThanOrEqual(44);
      expect(favoriteBox.height).toBeGreaterThanOrEqual(44);
    }

    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/?view=list#benefits");
    await page.waitForLoadState("networkidle");

    const firstCard = page.getByTestId("partner-card").first();
    await expect(firstCard.getByText("혜택", { exact: true })).toBeVisible();
    await expect(firstCard.getByText("적용 대상", { exact: true })).toBeVisible();
    await expect(page.getByTestId("partner-results-toolbar")).toContainText(/제휴처 \d+곳/);
  });

  test("keeps applied filters visible and individually removable", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 844 });
    await page.goto("/#benefits");
    await page.waitForLoadState("networkidle");

    await page.getByText("고급 필터", { exact: true }).click();
    await page.getByTestId("partner-campus-filter").selectOption("seoul");
    await expect(page).toHaveURL(/campus=seoul/);

    const activeFilters = page.getByTestId("partner-active-filters");
    await expect(activeFilters).toBeVisible();
    await activeFilters.getByRole("button", { name: "서울 캠퍼스 필터 해제" }).click();
    await expect(page).not.toHaveURL(/campus=seoul/);
  });

  test("lists partners and opens a public partner detail page", async ({ page }) => {
    await page.goto("/");

    const cards = page.getByTestId("partner-card");
    await expect(cards.first()).toBeVisible();

    const initialCount = await cards.count();
    expect(initialCount).toBeGreaterThan(0);

    const publicPartnerLink = cards
      .first()
      .getByRole("link", { name: "제휴 상세 보기" });
    await expect(publicPartnerLink).toBeVisible();
    await publicPartnerLink.scrollIntoViewIfNeeded();
    await publicPartnerLink.click();

    await expect(page).toHaveURL(/\/partners\/[^/?]+(?:\?|$)/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("opens a public partner detail page from the card surface", async ({ page }) => {
    await page.goto("/#benefits");

    const card = page.getByTestId("partner-card").first();
    await expect(card).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    await card.locator("p").first().click();

    await expect(page).toHaveURL(/\/partners\/[^/?]+(?:\?|$)/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("filters partners by search keyword and shows an empty state", async ({ page }) => {
    await page.goto("/");

    const cards = page.getByTestId("partner-card");

    await expect(cards.first()).toBeVisible();
    const initialCount = await cards.count();
    expect(initialCount).toBeGreaterThan(0);

    const firstPartnerName = (
      await cards.first().locator('a[aria-label$=" 상세 보기"]').first().textContent()
    )?.trim();
    expect(firstPartnerName).toBeTruthy();
    if (!firstPartnerName) {
      return;
    }

    await typeSearch(page, firstPartnerName);
    await expect(page.getByTestId("partner-search-input")).toHaveValue(firstPartnerName);
    await expect(cards).toHaveCount(1);
    await expect(page).toHaveURL(/q=/);

    await typeSearch(page, "");
    await expect(cards).toHaveCount(initialCount);

    await typeSearch(page, "xyznonexistentpartner123456789");
    await expect(cards).toHaveCount(0);

    await typeSearch(page, "");
    await expect(cards).toHaveCount(initialCount);
  });

  test("searches benefits and returns with filters intact", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const benefitsSection = page.locator("#benefits");
    await benefitsSection.scrollIntoViewIfNeeded();
    await expect(benefitsSection).toBeVisible();

    const cards = page.getByTestId("partner-card");
    const firstPartnerName = (
      await cards.first().locator('a[aria-label$=" 상세 보기"]').first().textContent()
    )?.trim();
    expect(firstPartnerName).toBeTruthy();
    if (!firstPartnerName) {
      return;
    }

    await typeSearch(page, firstPartnerName);
    await expect(page).toHaveURL(/q=/);

    const resultCard = cards.first();
    await expect(resultCard).toBeVisible();
    await resultCard.getByRole("link", { name: "제휴 상세 보기" }).click();

    await expect(page).toHaveURL(/returnTo=/);
    await page.getByRole("link", { name: "혜택 목록으로" }).click();

    await expect(page).toHaveURL(/q=/);
    await expect(page.getByTestId("partner-search-input")).toHaveValue(firstPartnerName);
  });
});
