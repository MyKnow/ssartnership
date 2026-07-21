import { expect, test } from "@playwright/test";

const viewports = [
  { key: "mobile-320", width: 320, height: 844 },
  { key: "mobile-360", width: 360, height: 844 },
  { key: "mobile-390", width: 390, height: 844 },
  { key: "tablet-768", width: 768, height: 1180 },
  { key: "tablet-820", width: 820, height: 1180 },
  { key: "tablet-1024", width: 1024, height: 1180 },
  { key: "desktop-1366", width: 1366, height: 900 },
  { key: "desktop-1440", width: 1440, height: 900 },
  { key: "desktop-1536", width: 1536, height: 900 },
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
    await expect(panel.getByRole("listitem")).toHaveCount(84);
    const hasDocumentOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(hasDocumentOverflow).toBe(true);
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
