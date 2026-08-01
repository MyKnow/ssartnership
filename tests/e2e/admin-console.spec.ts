import { expect, test } from "@playwright/test";

test.describe("authenticated administrator console", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/mock?returnTo=%2Fadmin");
    await expect(page).toHaveURL(/\/admin$/);
    await page.waitForLoadState("networkidle");
  });

  test("renders the admin home and permission-filtered navigation", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "관리 홈", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /회원/ }).first()).toBeVisible();
  });

  test("keeps the member search context in the rendered route", async ({ page }) => {
    await page.goto("/admin/members?search=%EC%A0%95%EB%AF%BC%ED%98%B8&page=1");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/admin\/members\?search=%EC%A0%95%EB%AF%BC%ED%98%B8&page=1$/);
    await expect(
      page.getByRole("heading", { name: "회원 계정 관리", exact: true }),
    ).toBeVisible();
  });

  test("renders registration search controls and preserves the query state", async ({ page }) => {
    await page.goto("/admin/partner-registrations");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "제휴 등록 신청 검토", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "검색어" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "공개 상태" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "정렬" })).toBeVisible();
    await page.getByRole("textbox", { name: "검색어" }).fill("싸피");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/partner-registrations\?.*q=%EC%8B%B8%ED%94%BC/);
  });

  test("keeps the registration queue inside narrow and wide viewports", async ({ page }) => {
    for (const width of [320, 360, 390, 820, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/partner-registrations");
      await page.waitForLoadState("networkidle");

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
    await page.goto("/admin/members");
    await page.waitForLoadState("networkidle");

    const opener = page.getByRole("button", { name: "관리 메뉴 열기" });
    await opener.click();

    const closeButton = page.getByRole("button", { name: "관리 메뉴 닫기" });
    await expect(closeButton).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "로그아웃" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
  });
});
