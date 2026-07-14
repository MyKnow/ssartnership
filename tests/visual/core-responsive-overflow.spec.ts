import { expect, test } from "@playwright/test";

const coreStoryIds = [
  "screens-public-homedirectoryview--default",
  "screens-public-partnerdetailview--default",
  "screens-public-partnerdetailaccessgate--locked",
  "domains-partnerregistration-actualview--web-input",
  "domains-partner-pagestates-dashboard--cafe-ssafy-mixed-plans",
  "domains-admin-pagestates--dashboard-overview",
  "domains-admin-adminmembermanager--default",
] as const;

const viewportWidths = [320, 360, 390, 768, 820, 1024, 1366, 1440, 1536] as const;

for (const width of viewportWidths) {
  test(`core stories have no document overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({
      width,
      height: width < 768 ? 844 : width < 1200 ? 1180 : 900,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const storyId of coreStoryIds) {
      await page.goto(`/iframe.html?id=${storyId}&viewMode=story`, {
        waitUntil: "domcontentloaded",
      });
      await page.locator("#storybook-root").waitFor({ state: "visible" });

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(
        dimensions.scrollWidth,
        `${storyId} overflowed at ${width}px`,
      ).toBe(dimensions.clientWidth);
    }
  });
}
