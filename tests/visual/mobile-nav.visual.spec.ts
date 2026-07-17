import { expect, test } from "@playwright/test";

test("mobile navigation drawer keeps account actions above the backdrop", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(
    "/iframe.html?id=domains-mobilenav--signed-in-escape-close&viewMode=story",
    { waitUntil: "domcontentloaded" },
  );
  await page.locator("#storybook-root").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "메뉴 열기" }).click();

  const drawer = page.getByRole("dialog", { name: "메뉴" });
  await expect(drawer).toBeVisible();
  const logoutButton = drawer.getByRole("button", { name: "로그아웃" });
  const hitTarget = await logoutButton.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return hit?.closest("button")?.getAttribute("aria-label") ?? hit?.textContent?.trim();
  });

  expect(hitTarget).toContain("로그아웃");
  await expect(page).toHaveScreenshot("mobile-nav-drawer-360.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.015,
    scale: "css",
  });
});
