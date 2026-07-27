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
