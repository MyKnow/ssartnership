import { expect, test } from "@playwright/test";

test("mobile navigation remains visible over the route loading surface", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()}`);
  });

  await page.setViewportSize({ width: 360, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(
    "/iframe.html?id=domains-mobilenav--route-loading&viewMode=story",
    { waitUntil: "domcontentloaded" },
  );
  await page.locator("#storybook-root").waitFor({ state: "visible" });
  const navigation = page.getByRole("navigation", { name: "모바일 주요 탐색" });
  const search = navigation.getByRole("link", { name: "혜택 검색" });
  const home = navigation.getByRole("link", { name: "홈" });

  await expect(navigation).toBeVisible();
  await expect(home).toHaveAttribute("aria-current", "page");
  await expect(search).toHaveAttribute("href", "/#benefit-search");

  const islandsAreSeparated = await navigation.evaluate((element) => {
    const searchIsland = element.querySelector<HTMLElement>("a[aria-label='혜택 검색']");
    const routeIsland = searchIsland?.previousElementSibling as HTMLElement | null;
    if (!searchIsland || !routeIsland) {
      return false;
    }
    return routeIsland.getBoundingClientRect().right < searchIsland.getBoundingClientRect().left;
  });
  expect(islandsAreSeparated).toBe(true);
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);

  await expect(navigation).toHaveScreenshot("mobile-nav-glass-360.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.01,
    scale: "css",
  });
  await expect(page).toHaveScreenshot("mobile-nav-route-loading-360.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.005,
    scale: "css",
  });
});
