import { expect, test } from "@playwright/test";

const viewports = [
  { key: "mobile-360", width: 360, height: 844 },
  { key: "tablet-820", width: 820, height: 1180 },
  { key: "desktop-1366", width: 1366, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`admin platform activity ${viewport.key}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(
      "/iframe.html?id=domains-admin-pagestates--dashboard-overview&viewMode=story",
      { waitUntil: "domcontentloaded" },
    );
    const panel = page.getByRole("region", { name: "서비스 활성도" });
    await expect(panel).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await expect(panel).toHaveScreenshot(
      `admin-platform-activity-${viewport.key}.png`,
      {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.015,
        scale: "css",
      },
    );
  });
}
