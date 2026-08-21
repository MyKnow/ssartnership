import { expect, test, type Page } from "@playwright/test";

async function waitForAdminShellHydration(page: Page) {
  await expect(
    page.locator('[data-admin-hydrated="true"]').first(),
  ).toBeVisible({ timeout: 15_000 });
}

async function openAdminRoute(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await waitForAdminShellHydration(page);
}

test.describe("authenticated administrator console", () => {
  test.beforeEach(async ({ page }) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.goto("/auth/mock?returnTo=%2Fadmin", {
        waitUntil: "domcontentloaded",
      });
      if (/\/admin$/.test(page.url())) {
        break;
      }
      await page.waitForTimeout(250 * (attempt + 1));
    }
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await waitForAdminShellHydration(page);
  });

  test("renders the admin home and permission-filtered navigation", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "관리 홈", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /회원/ }).first()).toBeVisible();
  });

  test("keeps the member search context in the rendered route", async ({ page }) => {
    await openAdminRoute(
      page,
      "/admin/members?search=%EC%A0%95%EB%AF%BC%ED%98%B8&page=1",
    );

    await expect(page).toHaveURL(/\/admin\/members\?search=%EC%A0%95%EB%AF%BC%ED%98%B8&page=1$/);
    await expect(
      page.getByRole("heading", { name: "회원 계정 관리", exact: true }),
    ).toBeVisible();
  });

  test("renders registration search controls and preserves the query state", async ({ page }) => {
    await openAdminRoute(page, "/admin/partner-registrations");

    await expect(
      page.getByRole("heading", { name: "제휴 등록 신청 검토", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("textbox", { name: "검색어" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("combobox", { name: "공개 상태" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("combobox", { name: "정렬" })).toBeVisible({
      timeout: 15_000,
    });
    const searchInput = page.getByRole("textbox", { name: "검색어" });
    await searchInput.fill("싸피");
    await Promise.all([
      page.waitForURL(/\/admin\/partner-registrations\?.*q=%EC%8B%B8%ED%94%BC/, {
        timeout: 15_000,
      }),
      page.getByRole("button", { name: "검색", exact: true }).click(),
    ]);
    await expect(searchInput).toHaveValue("싸피");
  });

  test("keeps the registration queue inside narrow and wide viewports", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await openAdminRoute(page, "/admin/partner-registrations");
    await expect(
      page.getByRole("heading", { name: "제휴 등록 신청 검토", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    for (const width of [320, 360, 390, 820, 1366]) {
      await page.setViewportSize({ width, height: 900 });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
      await page.screenshot({
        path: `.tmp/ui-qa/admin-partner-registrations-${width}.png`,
        fullPage: true,
      });
    }
  });

  test("traps mobile drawer focus and restores focus to its opener", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAdminRoute(page, "/admin/members");

    const opener = page.getByRole("button", { name: "관리 메뉴 열기" });
    await expect(opener).toBeVisible({ timeout: 15_000 });
    await opener.click();

    const closeButton = page.getByRole("button", { name: "관리 메뉴 닫기" });
    await expect(closeButton).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "로그아웃" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
  });
});
