import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function waitForDirectoryControls(page: Page) {
  await expect(page.getByTestId("partner-filter-interaction-root")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
}

async function gotoDirectory(page: Page, href: string) {
  await page.goto(href);
  await page.evaluate(() => document.fonts.ready);
  await waitForDirectoryControls(page);
}

async function typeSearch(page: Page, value: string) {
  await waitForDirectoryControls(page);
  const searchInput = page.getByTestId("partner-search-input");
  await searchInput.fill(value);
  await searchInput.press("Enter");
}

test.describe("public partner discovery", () => {
  test("renders benefit values in card view across responsive widths", async ({ page }) => {
    for (const viewport of [
      { width: 360, height: 900 },
      { width: 820, height: 900 },
      { width: 962, height: 740 },
      { width: 1366, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await gotoDirectory(page, "/?view=card#benefits");

      const card = page.getByTestId("partner-card").first();
      const benefitLabel = card.getByText("혜택", { exact: true });
      const benefitBlock = benefitLabel.locator("..");
      await expect(benefitLabel).toBeVisible();
      await expect(benefitBlock.locator("span").first()).toBeVisible();
      await expect(benefitBlock.getByText("혜택 정보 준비 중")).toHaveCount(0);
      await page.screenshot({
        path: `.tmp/ui-qa/issue-463-benefit-text/card-${viewport.width}.png`,
        animations: "disabled",
      });
    }
  });

  test("keeps applied filters visible and individually removable", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 844 });
    await gotoDirectory(page, "/#benefits");

    await page.getByTestId("partner-mobile-filter-disclosure").click();
    await page
      .getByTestId("partner-campus-filter-mobile-inline")
      .selectOption("seoul");
    await expect(page).toHaveURL(/campus=seoul/);

    const activeFilters = page.getByLabel("적용된 상세 필터");
    await expect(activeFilters).toBeVisible();
    await activeFilters.getByRole("button", { name: "서울 캠퍼스 필터 해제" }).click();
    await expect(page).not.toHaveURL(/campus=seoul/);
  });

  test("updates URL-backed filters without a server component navigation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoDirectory(page, "/?campaign=summer#benefits");
    await expect(page.getByTestId("partner-grid")).toBeVisible();

    const filterRscRequests: string[] = [];
    const captureFilterRscRequest = (request: import("@playwright/test").Request) => {
      const url = new URL(request.url());
      if (
        request.headers().rsc === "1" &&
        url.pathname === "/" &&
        ["category", "campus", "audience"].some((key) =>
          url.searchParams.has(key),
        )
      ) {
        filterRscRequests.push(request.url());
      }
    };

    page.on("request", captureFilterRscRequest);
    try {
      const categoryGroup = page.getByRole("group", {
        name: "제휴처 카테고리",
      });
      await page.evaluate(() => {
        const categoryButton = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            '[role="group"][aria-label="제휴처 카테고리"] button',
          ),
        ).find((button) => button.textContent?.trim() === "헬스");
        const campusFilter = document.querySelector<HTMLSelectElement>(
          '[data-testid="partner-campus-filter-desktop"]',
        );
        const audienceFilter = document.querySelector<HTMLSelectElement>(
          '[data-testid="partner-audience-filter-desktop"]',
        );

        if (!categoryButton || !campusFilter || !audienceFilter) {
          throw new Error("홈 필터 제어를 찾을 수 없습니다.");
        }

        categoryButton.click();
        campusFilter.value = "seoul";
        campusFilter.dispatchEvent(new Event("change", { bubbles: true }));
        audienceFilter.value = "student";
        audienceFilter.dispatchEvent(new Event("change", { bubbles: true }));
      });

      await expect(
        categoryGroup.getByRole("button", { name: "헬스", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.getByRole("button", { name: "서울 캠퍼스 필터 해제" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "교육생 적용 대상 필터 해제" }),
      ).toBeVisible();

      await expect.poll(() =>
        page.evaluate(() => {
          const url = new URL(window.location.href);
          return {
            audience: url.searchParams.get("audience"),
            campaign: url.searchParams.get("campaign"),
            campus: url.searchParams.get("campus"),
            category: url.searchParams.get("category"),
            hash: url.hash,
          };
        }),
      ).toEqual({
        audience: "student",
        campaign: "summer",
        campus: "seoul",
        category: "health",
        hash: "#benefits",
      });

      await page.waitForTimeout(250);
      expect(filterRscRequests).toEqual([]);
    } finally {
      page.off("request", captureFilterRscRequest);
    }
  });

  test("@critical lists partners and opens a public partner detail page", async ({ page }) => {
    await gotoDirectory(page, "/");

    const cards = page.getByTestId("partner-card");
    await expect(cards.first()).toBeVisible();

    const initialCount = await cards.count();
    expect(initialCount).toBeGreaterThan(0);

    const publicPartnerLink = cards
      .first()
      .getByRole("link", { name: / 상세 보기$/ });
    await expect(publicPartnerLink).toBeVisible();
    await publicPartnerLink.scrollIntoViewIfNeeded();
    await Promise.all([
      page.waitForURL(/\/partners\/[^/?]+(?:\?|$)/, { timeout: 15_000 }),
      publicPartnerLink.click(),
    ]);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("filters partners by search keyword and shows an empty state", async ({ page }) => {
    await gotoDirectory(page, "/");

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

    await typeSearch(page, "");
    await expect(cards).toHaveCount(initialCount);

    await typeSearch(page, "xyznonexistentpartner123456789");
    await expect(cards).toHaveCount(0);

    await typeSearch(page, "");
    await expect(cards).toHaveCount(initialCount);
  });

  test("applies a partner search only after an explicit submit", async ({ page }) => {
    await gotoDirectory(page, "/#benefits");
    const searchNavigations: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (request.headers().rsc === "1" && url.pathname === "/" && url.searchParams.has("q")) {
        searchNavigations.push(request.url());
      }
    });

    const cards = page.getByTestId("partner-card");
    const initialCount = await cards.count();
    const firstPartnerName = (
      await cards.first().locator('a[aria-label$=" 상세 보기"]').first().textContent()
    )?.trim();
    expect(firstPartnerName).toBeTruthy();
    if (!firstPartnerName) {
      return;
    }

    const searchInput = page.getByTestId("partner-search-input");
    await searchInput.fill(firstPartnerName);

    await expect(searchInput).toHaveValue(firstPartnerName);
    await expect(searchInput).toHaveAttribute("enterkeyhint", "search");
    expect(page.url()).not.toContain("q=");
    await expect(cards).toHaveCount(initialCount);

    await searchInput.press("Enter");
    await expect(page).toHaveURL(/q=/);
    await expect(cards).toHaveCount(1);
    expect(searchNavigations).toEqual([]);
    expect(new URL(page.url()).hash).toBe("#benefits");

    await searchInput.fill("");
    await expect(page).toHaveURL(/q=/);
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(cards).toHaveCount(initialCount);
    expect(new URL(page.url()).hash).toBe("#benefits");
    await page.goBack();
    await expect(page).toHaveURL(/q=/);
    await expect(searchInput).toHaveValue(firstPartnerName);
    await expect(cards).toHaveCount(1);
    await page.goForward();
    await expect(page).not.toHaveURL(/q=/);
    await expect(searchInput).toHaveValue("");
    await expect(cards).toHaveCount(initialCount);
    expect(searchNavigations).toEqual([]);
  });

  test("uses a clean detail URL and restores a submitted search with browser back", async ({
    page,
  }) => {
    await gotoDirectory(page, "/");
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
    await expect(cards).toHaveCount(1);
    const directoryUrl = page.url();

    const resultCard = cards.first();
    await expect(resultCard).toBeVisible();
    const detailLink = resultCard
      .locator('a[aria-label$=" 상세 보기"]')
      .first();
    await expect(detailLink).toHaveAttribute("href", /^\/partners\/[^?#]+$/);
    const detailHref = await detailLink.getAttribute("href");
    expect(detailHref).toBeTruthy();
    if (!detailHref) {
      return;
    }
    const cleanDetailUrl = new URL(detailHref, page.url()).toString();
    await detailLink.click();

    await expect(page).toHaveURL(/\/partners\/[^?#]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goBack();
    await waitForDirectoryControls(page);

    await expect(page).toHaveURL(directoryUrl);
    await expect(page.getByTestId("partner-search-input")).toHaveValue(firstPartnerName);
    await expect(cards).toHaveCount(1);

    await resultCard.locator("[data-partner-card-media]").click();

    await expect(page).toHaveURL(/\/partners\/[^?#]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goBack();
    await waitForDirectoryControls(page);

    await expect(page).toHaveURL(directoryUrl);
    await expect(page.getByTestId("partner-search-input")).toHaveValue(firstPartnerName);
    await expect(cards).toHaveCount(1);

    await page.goto(`${cleanDetailUrl}?returnTo=%2F%23benefits`);
    await expect(page).toHaveURL(cleanDetailUrl);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
